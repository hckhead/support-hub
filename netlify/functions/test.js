exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Netlify Functions is working!',
      timestamp: new Date().toISOString(),
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        headers: event.headers
      }
    })
  };
};
