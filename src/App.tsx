import React, { useState, useEffect, useRef } from 'react';
     import './App.css';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface Config {
  apiBase: string;
  apiKey: string;
  chatId: string;
  model: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config>({
    apiBase: process.env.REACT_APP_API_BASE || 'http://3.39.174.130:8080/api/v1',
    apiKey: process.env.REACT_APP_API_KEY || '',
    chatId: process.env.REACT_APP_CHAT_ID || '',
    model: process.env.REACT_APP_MODEL || 'gpt-4.1-mini',
  });
  const [showConfig, setShowConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiContentRef = useRef('');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('ragflowConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig) as Config;
        setConfig(parsedConfig);
      } catch (error) {
        console.error('설정 로드 오류:', error);
      }
    }
    const savedHistory = sessionStorage.getItem('chatHistory');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory) as Message[];
        setMessages(parsedHistory);
      } catch (error) {
        console.error('채팅 기록 로드 오류:', error);
      }
    }
    
    // 다크 테마 설정 로드
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      setIsDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('chatHistory', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveConfig = () => {
    localStorage.setItem('ragflowConfig', JSON.stringify(config));
    setShowConfig(false);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      setMessages((prev) => [...prev, { role: 'ai', content: '메시지를 입력해주세요.' }]);
      return;
    }
    
    if (!config.apiKey) {
      setMessages((prev) => [...prev, { role: 'ai', content: 'API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.' }]);
      return;
    }
    
    if (!config.chatId) {
      setMessages((prev) => [...prev, { role: 'ai', content: 'Agent ID가 설정되지 않았습니다. 설정에서 Agent ID를 입력해주세요.' }]);
      return;
    }
    
    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const requestBody = {
        model: config.model,
        messages: [
          { role: 'user', content: input }
        ],
        stream: true
      };

      const response = await fetch(`${config.apiBase}/agents_openai/${config.chatId}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${config.apiKey}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      aiContentRef.current = '';
      setCurrentAiMessage('');
      
      // AI 메시지 추가
      setMessages((prev) => [...prev, { role: 'ai', content: '' }]);

      // 누적 버퍼 (청크 경계 문제 해결)
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) { 
          setLoading(false); 
          break; 
        }
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        // 줄바꿈으로 분리하여 각 JSON 객체 처리
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;
          
          try {
            // data: 접두사 제거
            const jsonStr = line.replace(/^data: /, '').trim();
            if (!jsonStr) continue;
            
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              aiContentRef.current += content;
              setCurrentAiMessage(aiContentRef.current);
              
              // 메시지 업데이트
              setMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === 'ai') {
                  lastMessage.content = aiContentRef.current;
                  setForceUpdate(prev => prev + 1);
                }
                return updatedMessages;
              });
            }
          } catch (error) {
            // JSON 파싱 실패 시 무시 (불완전한 청크)
            continue;
          }
        }
      }
    } catch (error) {
      console.error('API 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setMessages((prev) => [...prev, { role: 'ai', content: `오류 발생: ${errorMessage}` }]);
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <header className={`flex justify-between items-center py-2 px-4 border-b transition-colors duration-200 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h1 
          onClick={() => {
            setMessages([]);
            setCurrentAiMessage('');
            setInput('');
            sessionStorage.removeItem('chatHistory');
          }}
          className={`text-lg font-medium cursor-pointer transition-colors duration-200 ${isDarkMode ? 'text-white hover:text-blue-400' : 'text-gray-800 hover:text-blue-600'}`}
        >
          Support Hub
        </h1>
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-full transition-colors duration-200 ${isDarkMode ? 'text-yellow-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button 
            onClick={() => setShowConfig(true)} 
            className={`text-xs px-2 py-1 rounded transition-colors duration-200 ${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            설정
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg shadow-xl w-full max-w-md mx-4 transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>API 설정</h2>
              <button 
                onClick={() => setShowConfig(false)}
                className={`transition-colors duration-200 ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Base URL</label>
                <input
                  value={config.apiBase}
                  onChange={(e) => setConfig({ ...config, apiBase: e.target.value })}
                  placeholder="https://your-ragflow-instance/api/v1"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Key</label>
                <input
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="your-api-key"
                  type="password"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Agent ID</label>
                <input
                  value={config.chatId}
                  onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                  placeholder="your-agent-id"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Model</label>
                <input
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder="gpt-3.5-turbo"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => setShowConfig(false)}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 ${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
              >
                취소
              </button>
              <button 
                onClick={() => {
                  saveConfig();
                  setShowConfig(false);
                }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {messages.length === 0 ? (
          /* Google-style centered layout when no messages */
          <div className="flex-1 flex flex-col justify-center items-center px-4">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">💬</div>
              <h2 className={`text-2xl font-light mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Support Hub에 오신 것을 환영합니다</h2>
            </div>
            
            {/* Google-style centered input */}
            <div className="w-full max-w-2xl">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="무엇을 도와드릴까요?"
                    className={`w-full px-6 py-4 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                  />
                </div>
                <button 
                  onClick={sendMessage} 
                  disabled={loading || !input.trim()}
                  className="px-8 py-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  전송
                </button>
              </div>
              {/* 경고 문구 */}
              <div className="mt-6 text-center">
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Support-Hub는 실수를 할 수 있습니다. 중요한 정보는 꼭 미들웨어솔루션팀으로 문의 부탁드립니다.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Chat layout when messages exist */
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={`${index}-${forceUpdate}`}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
                    }`}>
                     <div>
                        {msg.role === 'ai' && index === messages.length - 1 && currentAiMessage 
                          ? currentAiMessage 
                          : (msg.content || '(빈 메시지)')}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        <span className="text-sm">AI가 응답을 생성하고 있습니다...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
              {/* 경고 문구 */}
              <div className="mt-4 text-center">
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Support-Hub는 실수를 할 수 있습니다. 꼭 중요한 정보는 꼭 미들웨어솔루션팀으로 문의 부탁드립니다.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Fixed Input Area - Only visible when chat has started */}
        {messages.length > 0 && (
          <div className={`absolute bottom-0 left-0 right-0 border-t p-4 shadow-lg transition-colors duration-200 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="무엇을 도와드릴까요?"
                    className={`w-full px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                  />
                </div>
                <button 
                  onClick={sendMessage} 
                  disabled={loading || !input.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;