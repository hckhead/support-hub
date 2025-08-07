# Netlify 배포 가이드

## 1. Netlify CLI 설치 및 로그인

```bash
# Netlify CLI 설치 (이미 설치됨)
npm install -g netlify-cli

# Netlify 로그인
netlify login
```

## 2. 프로젝트 배포

```bash
# 프로젝트 빌드
npm run build

# Netlify에 배포
netlify deploy --prod --dir=build
```

## 3. 환경변수 설정

Netlify 대시보드에서 다음 환경변수를 설정하세요:

- `RAGFLOW_API_BASE`: `http://3.39.174.130/api/v1`

## 4. 로컬 개발 서버 실행

```bash
# Netlify 개발 서버 실행
netlify dev

# 또는 React 개발 서버 실행
npm start
```

## 5. 프록시 동작 방식

### 요청 흐름:
1. 브라우저 → `/api/chats_openai/{chatId}/chat/completions`
2. Netlify → `netlify/functions/proxy.js`
3. Proxy → `http://3.39.174.130/api/v1/chats_openai/{chatId}/chat/completions`
4. 응답 → 브라우저

### 장점:
- **HTTPS 보장**: 모든 요청이 HTTPS로 처리
- **CORS 해결**: 서버리스 함수에서 CORS 헤더 설정
- **성능**: Netlify의 글로벌 CDN 활용
- **보안**: API 키가 클라이언트에 노출되지 않음

## 6. 문제 해결

### 프록시 함수 로그 확인:
```bash
netlify functions:list
netlify functions:invoke proxy
```

### 환경변수 확인:
```bash
netlify env:list
```

## 7. 고급 설정

### 커스텀 도메인:
1. Netlify 대시보드 → Site settings → Domain management
2. Custom domain 추가

### SSL 인증서:
- Netlify에서 자동으로 Let's Encrypt 인증서 제공

### 캐싱 설정:
```toml
# netlify.toml에 추가
[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "no-cache"
```
