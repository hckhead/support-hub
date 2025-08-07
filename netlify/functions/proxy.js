const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // 원본 요청 정보 추출
    const { path, httpMethod, headers: requestHeaders, body } = event;
    
    // API 기본 URL (환경변수에서 가져오거나 기본값 사용)
    const apiBase = process.env.RAGFLOW_API_BASE || 'http://3.39.174.130/api/v1';
    
    // 경로에서 실제 API 엔드포인트 추출
    let apiPath = path;
    
    // 여러 가능한 경로 패턴 처리
    if (path.startsWith('/.netlify/functions/proxy')) {
      apiPath = path.replace('/.netlify/functions/proxy', '');
    } else if (path.startsWith('/api')) {
      apiPath = path.replace('/api', '');
    }
    
    // URL 검증 및 수정
    let targetUrl = `${apiBase}${apiPath}`;
    
    // URL이 유효한지 확인
    try {
      new URL(targetUrl);
    } catch (error) {
      console.error('Invalid URL:', targetUrl);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid URL',
          message: `Invalid URL: ${targetUrl}`,
          originalPath: path,
          apiPath: apiPath,
          apiBase: apiBase
        })
      };
    }
    
    console.log(`Original path: ${path}`);
    console.log(`API path: ${apiPath}`);
    console.log(`Target URL: ${targetUrl}`);
    console.log(`API Base: ${apiBase}`);
    
    // 요청 헤더 준비
    const proxyHeaders = {
      'Content-Type': 'application/json',
      'Authorization': requestHeaders.authorization || requestHeaders.Authorization || ''
    };
    
    // API 요청 실행
    const response = await fetch(targetUrl, {
      method: httpMethod,
      headers: proxyHeaders,
      body: body || undefined
    });
    
    // 응답 데이터 읽기
    const responseData = await response.text();
    
    // 응답 헤더 준비
    const responseHeaders = {
      ...headers,
      'Content-Type': response.headers.get('content-type') || 'application/json'
    };
    
    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseData
    };
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Proxy error',
        message: error.message
      })
    };
  }
};
