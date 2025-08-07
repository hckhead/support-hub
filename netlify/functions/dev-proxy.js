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
    const apiPath = path.replace('/.netlify/functions/dev-proxy', '');
    const targetUrl = `${apiBase}${apiPath}`;
    
    console.log(`Dev Proxy: ${event.httpMethod} ${apiPath} -> ${targetUrl}`);
    
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
    console.error('Dev Proxy error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Dev Proxy error',
        message: error.message
      })
    };
  }
};
