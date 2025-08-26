import React, { useState, useEffect, useRef } from 'react';
     import './App.css';

interface Message {
  role: 'user' | 'ai';
  content: string;
  references?: Array<{
    title: string;
    content?: string;
    metadata?: any;
    file_url?: string;
    file_type?: string;
    page_number?: number;
  }>;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [hoveredDocument, setHoveredDocument] = useState<{ content: string; title: string } | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });


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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };





  // 문서 호버 핸들러
  const handleDocumentHover = (event: React.MouseEvent, document: any) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredDocument({
      title: document.title || '문서',
      content: document.content || '내용이 없습니다.'
    });
  };

  const handleDocumentLeave = () => {
    setHoveredDocument(null);
  };

    // RAGFlow 문서 정보 조회 함수
  const fetchDocumentInfo = async (documentId: string) => {
    try {
      // RAGFlow Retrieve chunks API 사용
      const endpoint = `${config.apiBase}/api/v1/datasets/chunks/${documentId}`;
      
      console.log(`🔍 RAGFlow API 호출 시도: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`🔍 RAGFlow API 응답 상태: ${response.status}`);
      
      if (response.ok) {
        const chunkData = await response.json();
        console.log(`✅ 청크 ${documentId} 정보 성공:`, chunkData);
        
        return {
          title: chunkData.title || chunkData.name || chunkData.filename || `문서 ${documentId}`,
          content: chunkData.content || chunkData.text || chunkData.description || '내용을 불러올 수 없습니다.',
          file_url: chunkData.file_url || chunkData.url || chunkData.download_url,
          file_type: chunkData.file_type || chunkData.type || chunkData.mime_type,
          page_number: chunkData.page_number || chunkData.page,
          metadata: { id: documentId, ...chunkData }
        };
      } else {
        console.log(`❌ RAGFlow API 응답 실패: ${response.status}`);
        
        // API 실패 시 기본 정보 반환
        return {
          title: `문서 ${documentId}`,
          content: `문서 ID: ${documentId}의 정보를 조회할 수 없습니다.`,
          file_url: null,
          file_type: 'pdf',
          page_number: null,
          metadata: { id: documentId }
        };
      }
      
    } catch (error) {
      console.log(`❌ 문서 ${documentId} 정보 조회 실패:`, error);
      return {
        title: `문서 ${documentId}`,
        content: '문서 정보를 불러올 수 없습니다.',
        metadata: { id: documentId }
      };
    }
  };

  // 메시지 포맷팅 함수
  const formatMessage = (content: string) => {
    console.log('🔧 포맷팅 전:', content);
    
    // 마크다운 처리
    const formatted = content.split('\n').map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        return '<br>';
      } else {
        // 볼드 텍스트 처리 (한 줄 내에서 여러 개 가능)
        let processedLine = trimmedLine;
        
        // **텍스트** 패턴 처리
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // *텍스트* 패턴 처리 (이탤릭)
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // `텍스트` 패턴 처리 (코드)
        processedLine = processedLine.replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded text-sm">$1</code>');
        
        console.log('🔧 처리된 라인:', processedLine);
        return `<div class="mb-1">${processedLine}</div>`;
      }
    }).join('');
    
    console.log('🔧 포맷팅 후:', formatted);
    return formatted;
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
    setAttachedFiles([]); // 첨부파일 초기화
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
              
              // RAGFlow 특화 구조 분석
              if (parsed.choices[0].delta.context) {
                console.log('📚 Context 구조:', parsed.choices[0].delta.context);
              }
              if (parsed.choices[0].delta.metadata) {
                console.log('📋 Metadata 구조:', parsed.choices[0].delta.metadata);
              }
              if (parsed.choices[0].delta.tool_calls) {
                console.log('🔧 Tool calls 구조:', parsed.choices[0].delta.tool_calls);
              }
              
              // RAGFlow 특화: 추가 정보 추출
              const delta = parsed.choices[0].delta;
              if (delta.sources) {
                console.log('📖 Sources 정보:', delta.sources);
              }
              if (delta.documents) {
                console.log('📄 Documents 정보:', delta.documents);
              }
              if (delta.citations) {
                console.log('📝 Citations 정보:', delta.citations);
              }
              if (delta.retrieved_documents) {
                console.log('🔍 Retrieved documents:', delta.retrieved_documents);
              }
              if (delta.metadata && delta.metadata.documents) {
                console.log('📋 Metadata documents:', delta.metadata.documents);
              }
              if (delta.context && delta.context.documents) {
                console.log('📚 Context documents:', delta.context.documents);
              }
              
              // 전체 응답 구조를 더 자세히 로깅
              console.log('🔍 전체 delta 구조:', JSON.stringify(delta, null, 2));
            }
            
            const content = parsed.choices?.[0]?.delta?.content;
            
            // 참조 정보 추출 (RAGFlow API 응답 구조에 따라)
            let references = parsed.choices?.[0]?.delta?.references || 
                            parsed.choices?.[0]?.delta?.context?.references ||
                            parsed.choices?.[0]?.delta?.metadata?.references ||
                            parsed.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
            
            // RAGFlow 특화: 스트리밍 응답에서 문서 정보 추출
            if (!references) {
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                // 다양한 필드에서 문서 정보 찾기
                references = references || delta.documents || delta.sources || delta.citations || delta.retrieved_documents;
                
                // context에서 문서 정보 찾기
                if (delta.context && typeof delta.context === 'object') {
                  references = references || delta.context.documents || delta.context.sources || delta.context.references;
                }
                
                // metadata에서 문서 정보 찾기
                if (delta.metadata && typeof delta.metadata === 'object') {
                  references = references || delta.metadata.documents || delta.metadata.sources || delta.metadata.references;
                }
              }
            }
            
            // RAGFlow 특화 참조 정보 추출
            if (!references) {
              // context에서 참조 정보 찾기
              const context = parsed.choices?.[0]?.delta?.context;
              if (context && typeof context === 'object') {
                references = context.references || context.documents || context.sources;
              }
              
              // metadata에서 참조 정보 찾기
              const metadata = parsed.choices?.[0]?.delta?.metadata;
              if (metadata && typeof metadata === 'object') {
                references = references || metadata.references || metadata.documents || metadata.sources;
              }
              
              // tool_calls에서 참조 정보 찾기
              const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
              if (toolCalls && Array.isArray(toolCalls)) {
                for (const toolCall of toolCalls) {
                  if (toolCall.function?.arguments) {
                    try {
                      const args = JSON.parse(toolCall.function.arguments);
                      references = references || args.references || args.documents || args.sources;
                    } catch (e) {
                      // JSON 파싱 실패 시 무시
                    }
                  }
                }
              }
              
              // RAGFlow 특화 필드들 확인
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                references = references || delta.sources || delta.documents || delta.citations || delta.retrieved_documents;
              }
            }
            
            // 디버깅: 참조 정보 로깅
            if (references) {
              console.log('🔍 발견된 참조 정보:', references);
            }
            
            // 첨부파일 정보 추출
            const attachments = parsed.choices?.[0]?.delta?.attachments ||
                               parsed.choices?.[0]?.delta?.files ||
                               parsed.choices?.[0]?.delta?.metadata?.attachments;
            
            // 파일 URL 정보 추출
            const fileUrls = parsed.choices?.[0]?.delta?.file_urls ||
                            parsed.choices?.[0]?.delta?.metadata?.file_urls;
            
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
                  
                                    // 참조 정보가 있으면 업데이트 (하지만 나중에 덮어쓸 예정)
                  if (references && Array.isArray(references)) {
                    console.log('🔍 기존 참조 정보 발견:', references);
                  }
                  
                  // 전체 텍스트에서 참조 문서 추출 (항상 실행)
                  console.log('🔍 참조 문서 추출 시작 - aiContentRef.current 길이:', aiContentRef.current.length);
                  if (aiContentRef.current && aiContentRef.current.length > 0) { // 내용이 있을 때만 실행
                    const content = aiContentRef.current;
                    
                    // 전체 텍스트에서 ID 추출 (쉼표로 구분된 형태도 포함)
                    const idPattern = /\[ID:(\d+)\]/g;
                    const matches: string[] = [];
                    let match;
                    
                    while ((match = idPattern.exec(content)) !== null) {
                      matches.push(match[1]);
                    }
                    
                    // 추가로 "ID:숫자" 형태도 추출 (쉼표로 구분된 경우)
                    const simpleIdPattern = /ID:(\d+)/g;
                    let simpleMatch;
                    
                    while ((simpleMatch = simpleIdPattern.exec(content)) !== null) {
                      if (!matches.includes(simpleMatch[1])) {
                        matches.push(simpleMatch[1]);
                      }
                    }
                    
                                         console.log('🔍 전체 텍스트에서 추출된 ID들:', matches);
                     console.log('🔍 전체 텍스트 내용:', content);
                    
                    if (matches.length > 0) {
                      // 중복 제거하고 상위 1개만
                      const uniqueIds: string[] = [];
                      matches.forEach(id => {
                        if (!uniqueIds.includes(id) && uniqueIds.length < 1) {
                          uniqueIds.push(id);
                        }
                      });
                      
                      console.log('🔍 추출된 고유 ID들:', uniqueIds);
                      
                      // 각 ID에 대한 내용 찾기
                      const references = uniqueIds.map((id, index) => {
                        // 근거 섹션에서 해당 ID에 대한 내용 찾기
                        const basisPattern = /\*\*근거\*\*:\s*([\s\S]*?)(?=\*\*추가 정보\*\*:|\*\*제한사항\*\*:|$)/i;
                        const basisMatch = content.match(basisPattern);
                        let documentContent = '';
                        
                        if (basisMatch) {
                          const basisContent = basisMatch[1];
                          // 해당 ID가 포함된 문장 찾기
                          const sentences = basisContent.split(/[.!?]\s+/);
                          
                          for (const sentence of sentences) {
                            if (sentence.includes(`[ID:${id}]`) || sentence.includes(`ID:${id}`)) {
                              // ID 부분을 제거하고 내용만 추출
                              const cleanContent = sentence.replace(/\[?ID:${id}\]?/g, '').trim();
                              if (cleanContent) {
                                documentContent = cleanContent;
                                break;
                              }
                            }
                          }
                        }
                        
                        // 근거 섹션에서 찾지 못하면 전체 텍스트에서 찾기
                        if (!documentContent) {
                          const sentences = content.split(/[.!?]\s+/);
                          for (const sentence of sentences) {
                            if (sentence.includes(`[ID:${id}]`) || sentence.includes(`ID:${id}`)) {
                              const cleanContent = sentence.replace(/\[?ID:${id}\]?/g, '').trim();
                              if (cleanContent) {
                                documentContent = cleanContent;
                                break;
                              }
                            }
                          }
                        }
                        
                        // 내용이 없으면 기본값
                        if (!documentContent) {
                          documentContent = `문서 ${id}에서 참조된 내용`;
                        }
                        
                        // 파일 이름과 내용 추출
                        let actualTitle = `문서 ${id}`;
                        let extractedContent = `문서 ${id}에서 참조된 내용`;
                        
                        // 전체 텍스트에서 해당 ID가 포함된 문장 찾기
                        const sentences = content.split(/[.!?]\s+/);
                        for (const sentence of sentences) {
                          if (sentence.includes(`[ID:${id}]`) || sentence.includes(`ID:${id}`)) {
                            console.log(`🔍 ID ${id}가 포함된 문장:`, sentence);
                            
                            // ID 부분을 제거하고 내용 추출
                            const cleanSentence = sentence.replace(/\[?ID:${id}\]?/g, '').trim();
                            if (cleanSentence && cleanSentence.length > 0) {
                              // 파일 이름: 첫 번째 의미있는 단어들
                              const words = cleanSentence.split(/\s+/).slice(0, 4);
                              actualTitle = words.join(' ');
                              
                              // 호버 내용: 전체 문장 내용
                              extractedContent = cleanSentence;
                              
                              console.log(`✅ 문서 ${id} 제목 추출:`, actualTitle);
                              console.log(`✅ 문서 ${id} 내용 추출:`, extractedContent);
                              break;
                            }
                          }
                        }
                        
                        console.log(`📄 최종 문서 ${id} 제목:`, actualTitle);
                        console.log(`📄 최종 문서 ${id} 내용:`, extractedContent);
                        
                        return {
                          title: actualTitle, // 실제 문서 제목 사용
                          content: extractedContent, // 호버 시 표시할 내용
                          metadata: { id: id }
                        };
                      });
                      
                      // 먼저 기본 참조 정보로 설정
                      setMessages((prev) => {
                        const updatedMessages = [...prev];
                        const lastMsg = updatedMessages[updatedMessages.length - 1];
                        if (lastMsg && lastMsg.role === 'ai') {
                          lastMsg.references = references;
                          setForceUpdate(prev => prev + 1);
                        }
                        return updatedMessages;
                      });
                      
                      // 비동기로 실제 문서 정보 가져오기
                      const fetchDocuments = async () => {
                        console.log('🔍 문서 정보 조회 시작:', uniqueIds);
                        const documentPromises = uniqueIds.map(id => fetchDocumentInfo(id));
                        const documentResults = await Promise.allSettled(documentPromises);
                        
                        const updatedReferences = documentResults
                          .map((result, index) => {
                            const originalRef = references[index];
                            let finalTitle = originalRef.title; // 이미 추출된 실제 제목 사용
                            
                            // API가 성공하고 더 나은 제목을 제공하는 경우에만 업데이트
                            if (result.status === 'fulfilled') {
                              const docInfo = result.value;
                              console.log(`📄 문서 ${uniqueIds[index]} 정보:`, docInfo);
                              
                              // API에서 가져온 제목이 기본값이 아닌 경우에만 사용
                              if (docInfo.title && docInfo.title !== `문서 ${uniqueIds[index]}`) {
                                finalTitle = docInfo.title;
                              }
                            }
                            
                            return {
                              ...originalRef,
                              title: finalTitle, // 추출된 실제 제목 우선 사용
                              file_url: result.status === 'fulfilled' ? result.value.file_url : undefined,
                              file_type: result.status === 'fulfilled' ? result.value.file_type : undefined,
                              page_number: result.status === 'fulfilled' ? result.value.page_number : undefined
                            };
                          });
                        
                        console.log('📄 업데이트된 참조들:', updatedReferences);
                        
                        if (updatedReferences.length > 0) {
                          setMessages((prev) => {
                            const updatedMessages = [...prev];
                            const lastMsg = updatedMessages[updatedMessages.length - 1];
                            if (lastMsg && lastMsg.role === 'ai') {
                              lastMsg.references = updatedReferences;
                              setForceUpdate(prev => prev + 1);
                            }
                            return updatedMessages;
                          });
                        }
                      };
                      
                      fetchDocuments();
                    }
                  }
                  
                  // 첨부파일 정보가 있으면 업데이트
                  if (attachments && Array.isArray(attachments)) {
                    lastMessage.attachments = attachments;
                  }
                  
                  // 파일 URL 정보가 있으면 참조에 추가
                  if (fileUrls && Array.isArray(fileUrls) && lastMessage.references) {
                    fileUrls.forEach((fileUrl, index) => {
                      if (lastMessage.references && lastMessage.references[index]) {
                        lastMessage.references[index].file_url = fileUrl;
                      }
                    });
                  }
                  
                  setForceUpdate(prev => prev + 1);
                }
                return updatedMessages;
              });
            }
            
            // 참조 정보만 있는 경우 (content가 없지만 references가 있는 경우)
            if (!content && (references || attachments || fileUrls)) {
              setMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === 'ai') {
                  if (references && Array.isArray(references)) {
                    lastMessage.references = references;
                  }
                  if (attachments && Array.isArray(attachments)) {
                    lastMessage.attachments = attachments;
                  }
                  if (fileUrls && Array.isArray(fileUrls) && lastMessage.references) {
                    fileUrls.forEach((fileUrl, index) => {
                      if (lastMessage.references && lastMessage.references[index]) {
                        lastMessage.references[index].file_url = fileUrl;
                      }
                    });
                  }
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
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? 'gradient-bg-dark text-white dark' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <header className={`flex justify-between items-center py-3 px-6 ${isDarkMode ? 'liquid-glass-dark' : 'bg-white border border-gray-200'} rounded-b-2xl mx-4 mt-4 transition-all duration-300 shadow-lg`}>
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
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`p-6 ${isDarkMode ? 'liquid-glass-card-dark' : 'bg-white border border-gray-200'} w-full max-w-md mx-4 transition-all duration-300 shadow-xl rounded-2xl`}>
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
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${isDarkMode ? 'liquid-glass-input-dark text-white placeholder-gray-300' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Key</label>
                <input
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="your-api-key"
                  type="password"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${isDarkMode ? 'liquid-glass-input-dark text-white placeholder-gray-300' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Agent ID</label>
                <input
                  value={config.chatId}
                  onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                  placeholder="your-agent-id"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${isDarkMode ? 'liquid-glass-input-dark text-white placeholder-gray-300' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Model</label>
                <input
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder="gpt-3.5-turbo"
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${isDarkMode ? 'liquid-glass-input-dark text-white placeholder-gray-300' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => setShowConfig(false)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${isDarkMode ? 'liquid-glass-dark text-gray-300 hover:text-white' : 'liquid-glass text-gray-600 hover:text-gray-800'}`}
              >
                취소
              </button>
              <button 
                onClick={() => {
                  saveConfig();
                  setShowConfig(false);
                }} 
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg"
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
              <h2 className={`text-2xl font-semibold mb-3 welcome-title ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Support Hub에 오신 것을 환영합니다</h2>
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
                    className={`w-full px-6 py-4 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg transition-all duration-300 ${isDarkMode ? 'liquid-glass-input-dark text-white placeholder-gray-300' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                  />
                </div>
                <button 
                  onClick={sendMessage} 
                  disabled={loading || !input.trim()}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg transition-all duration-300"
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
            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={`${index}-${forceUpdate}`}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                        : isDarkMode ? 'liquid-glass-card-dark text-gray-200' : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className="message-content">
                        {msg.role === 'ai' && index === messages.length - 1 && currentAiMessage 
                          ? <div dangerouslySetInnerHTML={{ __html: formatMessage(currentAiMessage) }} />
                          : <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content || '(빈 메시지)') }} />
                        }
                      </div>
                      
                      {/* 참조 문서 정보 표시 */}
                      {msg.role === 'ai' && msg.references && msg.references.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                          <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            📚 참조 문서:
                          </div>
                          <div className="space-y-2">
                            {msg.references.map((ref, refIndex) => (
                              <div key={refIndex} className={`text-xs p-3 rounded-lg border ${isDarkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                <div 
                                  className="font-medium flex items-center justify-between mb-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded transition-colors"
                                  onMouseEnter={(e) => handleDocumentHover(e, ref)}
                                  onMouseLeave={handleDocumentLeave}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg">
                                      {ref.file_type === 'pdf' ? '📄' : 
                                       ref.file_type?.includes('image') ? '🖼️' : 
                                       ref.file_type?.includes('document') ? '📝' : '📎'}
                                    </span>
                                    <span>{ref.title || `문서 ${refIndex + 1}`}</span>
                                  </div>
                                  {ref.file_url && (
                                    <button
                                      onClick={() => window.open(ref.file_url, '_blank')}
                                      className={`text-xs px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                                      title="새 탭에서 파일 열기"
                                    >
                                      📄 보기
                                    </button>
                                  )}
                                </div>

                                {ref.page_number && (
                                  <div className="mt-1 text-xs text-gray-400">
                                    📄 페이지: {ref.page_number}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 첨부파일 표시 */}
                      {msg.role === 'ai' && msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                          <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            📎 첨부파일:
                          </div>
                          <div className="space-y-1">
                            {msg.attachments.map((attachment, index) => (
                              <div key={index} className={`text-xs p-2 rounded flex items-center justify-between ${isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-50 text-gray-700'}`}>
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">
                                    {attachment.type === 'pdf' ? '📄' : 
                                     attachment.type === 'image' ? '🖼️' : 
                                     attachment.type === 'document' ? '📝' : '📎'}
                                  </span>
                                  <span className="font-medium">{attachment.name}</span>
                                  {attachment.size && (
                                    <span className="text-gray-400">
                                      ({(attachment.size / 1024).toFixed(1)} KB)
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => window.open(attachment.url, '_blank')}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                                >
                                  다운로드
                                </button>
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
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${isDarkMode ? 'liquid-glass-card-dark text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
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
          <div className={`fixed bottom-0 left-0 right-0 p-4 z-10 ${isDarkMode ? 'liquid-glass-dark' : 'bg-white border border-gray-200'} rounded-t-2xl mx-4 mb-4 transition-all duration-300 shadow-lg`}>
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="무엇을 도와드릴까요?"
                    className={`w-full px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all duration-300 ${isDarkMode ? 'liquid-glass-input-dark text-white placeholder-gray-300' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                  />
                </div>
                <label className={`cursor-pointer p-3 rounded-full transition-all duration-300 ${isDarkMode ? 'liquid-glass-dark hover:bg-gray-600 text-gray-300' : 'liquid-glass hover:bg-gray-200 text-gray-600'}`}>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  />
                  📎
                </label>
                <button 
                  onClick={sendMessage} 
                  disabled={loading || !input.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium shadow-lg transition-all duration-300"
                >
                  전송
                </button>
              </div>
              
              {/* 첨부된 파일 목록 */}
              {attachedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    📎 첨부된 파일 ({attachedFiles.length}개):
                  </div>
                  <div className="space-y-1">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className={`flex items-center justify-between p-2 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {file.type === 'application/pdf' ? '📄' : 
                             file.type.startsWith('image/') ? '🖼️' : 
                             file.type.includes('document') ? '📝' : '📎'}
                          </span>
                          <span className="font-medium">{file.name}</span>
                          <span className="text-gray-400">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* 문서 미리보기 팝업 */}
      {hoveredDocument && (
        <div 
          className={`fixed z-50 max-w-md ${isDarkMode ? 'liquid-glass-card-dark' : 'liquid-glass-card'} rounded-2xl shadow-xl p-4 text-sm transition-all duration-300`}
          style={{
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            pointerEvents: 'none'
          }}
        >
          <div className="font-medium text-gray-900 dark:text-white mb-2">
            {hoveredDocument.title}
          </div>
          <div className="text-gray-600 dark:text-gray-300 text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
            {hoveredDocument?.content && hoveredDocument.content.length > 500 
              ? hoveredDocument.content.substring(0, 500) + '...' 
              : hoveredDocument?.content
            }
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-300 dark:border-t-gray-600"></div>
        </div>
      )}
    </div>
  );
};

export default App;