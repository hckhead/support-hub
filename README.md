# RAGFlow Chat App

RAGFlow API를 사용한 채팅 애플리케이션입니다.

## 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경변수들을 설정하세요:

```env
# RAGFlow API 설정
REACT_APP_API_BASE=https://your-ragflow-instance/api/v1
REACT_APP_API_KEY=your-api-key-here
REACT_APP_CHAT_ID=your-chat-id-here
REACT_APP_MODEL=gpt-3.5-turbo

# 개발 환경 설정
REACT_APP_ENV=development
```

### 환경변수 설명

- `REACT_APP_API_BASE`: RAGFlow API 서버의 기본 URL
- `REACT_APP_API_KEY`: RAGFlow API 인증 키
- `REACT_APP_CHAT_ID`: 채팅 세션 ID
- `REACT_APP_MODEL`: 사용할 AI 모델 (기본값: gpt-3.5-turbo)

## 기술 스택

- React 19
- TypeScript
- Tailwind CSS
- Create React App

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
