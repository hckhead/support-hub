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
    apiBase: process.env.REACT_APP_API_BASE || 'https://your-ragflow-instance/api/v1',
    apiKey: process.env.REACT_APP_API_KEY || '',
    chatId: process.env.REACT_APP_CHAT_ID || '',
    model: process.env.REACT_APP_MODEL || 'gpt-3.5-turbo',
  });
  const [showConfig, setShowConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiContentRef = useRef('');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [currentAiMessage, setCurrentAiMessage] = useState('');

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
      setMessages((prev) => [...prev, { role: 'ai', content: 'Chat ID가 설정되지 않았습니다. 설정에서 Chat ID를 입력해주세요.' }]);
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

      const response = await fetch(`${config.apiBase}/chats_openai/${config.chatId}/chat/completions`, {
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) { 
          setLoading(false); 
          break; 
        }
        
        const chunk = new TextDecoder().decode(value);
        
        // 간단한 문자열 처리로 content 추출
        if (chunk.includes('"content":')) {
          const contentMatch = chunk.match(/"content":\s*"([^"]*)"/);
          if (contentMatch && contentMatch[1]) {
            const content = contentMatch[1];
            
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
        <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
        <h1 className="text-lg font-medium text-gray-800">Support Hub</h1>
        <button 
          onClick={() => setShowConfig(true)} 
          className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-100"
        >
          설정
        </button>
      </header>

      {/* Settings Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">API 설정</h2>
              <button 
                onClick={() => setShowConfig(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                <input
                  value={config.apiBase}
                  onChange={(e) => setConfig({ ...config, apiBase: e.target.value })}
                  placeholder="https://your-ragflow-instance/api/v1"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="your-api-key"
                  type="password"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chat ID</label>
                <input
                  value={config.chatId}
                  onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                  placeholder="your-chat-id"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder="gpt-3.5-turbo"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  saveConfig();
                  setShowConfig(false);
                }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {messages.length === 0 ? (
          /* Google-style centered layout when no messages */
          <div className="flex-1 flex flex-col justify-center items-center px-4">
                        <div className="text-center mb-8">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-light text-gray-600 mb-2">Support Hub에 오신 것을 환영합니다</h2>
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
                    className="w-full px-6 py-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
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
            </div>
          </div>
        ) : (
          /* Chat layout when messages exist */
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={`${index}-${forceUpdate}`}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
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
                    <div className="bg-gray-100 text-gray-800 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        <span className="text-sm">AI가 응답을 생성하고 있습니다...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </div>

            {/* Fixed Input Area */}
            <div className="border-t border-gray-200 p-3">
              <div className="max-w-4xl mx-auto px-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 relative">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="메시지를 입력하세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <button 
                    onClick={sendMessage} 
                    disabled={loading || !input.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;