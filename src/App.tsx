import React, { useState, useEffect, useRef } from 'react';
     import './App.css';

interface Message {
  role: 'user' | 'ai';
  content: string;
  references?: Array<{
    title: string;
    content?: string;
    metadata?: any;
  }>;
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

  // 메시지 포맷팅 함수
  const formatMessage = (content: string) => {
    // 마크다운 처리
    return content.split('\n').map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        return '<br>';
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        // 볼드 텍스트 처리
        return `<div class="font-bold mb-1">${trimmedLine.replace(/\*\*/g, '')}</div>`;
      } else {
        return `<div class="mb-1">${trimmedLine}</div>`;
      }
    }).join('');
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

    // 디버깅: API 호출 정보 로그
    console.log('🚀 API 호출 시작:', {
      url: `${config.apiBase}/agents_openai/${config.chatId}/chat/completions`,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : '없음',
      chatId: config.chatId,
      model: config.model,
      userMessage: input
    });

    try {
      const requestBody = {
        model: config.model,
        messages: [
          { role: 'user', content: input }
        ],
        stream: true
      };

      console.log('📤 요청 본문:', requestBody);

      const response = await fetch(`${config.apiBase}/agents_openai/${config.chatId}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${config.apiKey}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 응답 상태:', response.status, response.statusText);
      console.log('📥 응답 헤더:', Object.fromEntries(response.headers.entries()));

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
      
      // AI 메시지 추가 (참조 정보 포함)
      setMessages((prev) => [...prev, { role: 'ai', content: '', references: [] }]);

      // 누적 버퍼 (청크 경계 문제 해결)
      let buffer = '';
      let chunkCount = 0;
      let hasContent = false;

      console.log('🔄 스트리밍 시작...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) { 
          console.log('✅ 스트리밍 완료. 총 청크 수:', chunkCount, '콘텐츠 있음:', hasContent);
          setLoading(false); 
          
          // 콘텐츠가 없으면 에러 메시지 표시
          if (!hasContent) {
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              if (lastMessage && lastMessage.role === 'ai') {
                lastMessage.content = `❌ 응답이 비어있습니다. (청크 수: ${chunkCount})\n\n가능한 원인:\n• API 키 또는 Agent ID가 잘못되었습니다\n• 서버 연결에 문제가 있습니다\n• 요청 형식이 올바르지 않습니다\n\n콘솔에서 자세한 로그를 확인해주세요.`;
              }
              return updatedMessages;
            });
          }
          break; 
        }
        
        chunkCount++;
        const chunk = new TextDecoder().decode(value);
        console.log(`📦 청크 ${chunkCount}:`, chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''));
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
            
            // 디버깅: 전체 응답 구조 확인
            if (parsed.choices?.[0]?.delta && Object.keys(parsed.choices[0].delta).length > 0) {
              console.log('Streaming response delta:', parsed.choices[0].delta);
            }
            
            const content = parsed.choices?.[0]?.delta?.content;
            
            // 참조 정보 추출 (RAGFlow API 응답 구조에 따라)
            const references = parsed.choices?.[0]?.delta?.references || 
                              parsed.choices?.[0]?.delta?.context?.references ||
                              parsed.choices?.[0]?.delta?.metadata?.references ||
                              parsed.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
            
            if (content) {
              hasContent = true;
              aiContentRef.current += content;
              setCurrentAiMessage(aiContentRef.current);
              
              // 메시지 업데이트
              setMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === 'ai') {
                  lastMessage.content = aiContentRef.current;
                  
                  // 참조 정보가 있으면 업데이트
                  if (references && Array.isArray(references)) {
                    lastMessage.references = references;
                  }
                  
                  setForceUpdate(prev => prev + 1);
                }
                return updatedMessages;
              });
            }
            
            // 참조 정보만 있는 경우 (content가 없지만 references가 있는 경우)
            if (!content && references && Array.isArray(references) && references.length > 0) {
              setMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === 'ai') {
                  lastMessage.references = references;
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
      console.error('❌ API 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      
      // 더 자세한 에러 정보 제공
      let detailedError = `❌ 오류 발생: ${errorMessage}`;
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        detailedError += '\n\n네트워크 연결을 확인해주세요.';
      } else if (errorMessage.includes('401')) {
        detailedError += '\n\nAPI 키가 잘못되었습니다. 설정에서 확인해주세요.';
      } else if (errorMessage.includes('404')) {
        detailedError += '\n\nAgent ID가 잘못되었습니다. 설정에서 확인해주세요.';
      } else if (errorMessage.includes('500')) {
        detailedError += '\n\n서버 내부 오류입니다. 잠시 후 다시 시도해주세요.';
      }
      
      detailedError += '\n\n콘솔에서 자세한 로그를 확인해주세요.';
      
      setMessages((prev) => [...prev, { role: 'ai', content: detailedError }]);
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? 'bg-gray-900 text-white dark' : 'bg-white text-gray-900'}`}>
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
                      <div 
                        className="message-content"
                        dangerouslySetInnerHTML={{
                          __html: msg.role === 'ai' && index === messages.length - 1 && currentAiMessage 
                            ? formatMessage(currentAiMessage)
                            : formatMessage(msg.content || '(빈 메시지)')
                        }}
                      />
                      
                      {/* 참조 문서 정보 표시 */}
                      {msg.role === 'ai' && msg.references && msg.references.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                          <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            📚 참조 문서:
                          </div>
                          <div className="space-y-1">
                            {msg.references.map((ref, refIndex) => (
                              <div key={refIndex} className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-50 text-gray-700'}`}>
                                <div className="font-medium">{ref.title || `문서 ${refIndex + 1}`}</div>
                                {ref.content && (
                                  <div className="mt-1 text-gray-500 dark:text-gray-400 line-clamp-2">
                                    {ref.content}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
              {/* 경고 문구 - 채팅 하단 */}
              <div className="mt-3 text-center">
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Support-Hub는 실수를 할 수 있습니다. 중요한 정보는 꼭 미들웨어솔루션팀으로 문의 부탁드립니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;