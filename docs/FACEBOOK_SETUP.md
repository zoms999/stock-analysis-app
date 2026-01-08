# 페이스북 로그인 연동 가이드

이 프로젝트에는 페이스북 로그인 기능이 이미 구현되어 있습니다. 아래 단계를 따라 설정하시면 됩니다.

## 📋 사전 준비사항

1. **Supabase 프로젝트** (이미 설정되어 있어야 함)
2. **Facebook 개발자 계정** (https://developers.facebook.com)

## 🔧 설정 단계

### 1단계: Facebook 앱 생성

1. [Facebook Developers](https://developers.facebook.com)에 접속하여 로그인
2. **내 앱** → **앱 만들기** 클릭
3. 앱 유형 선택: **소비자** 또는 **비즈니스** 선택
4. 앱 정보 입력:
   - **앱 표시 이름**: 원하는 이름 (예: "Stock Chart Analysis")
   - **앱 연락처 이메일**: 본인 이메일
   - **앱 용도**: 선택 (일반적으로 "비즈니스" 선택)

### 2단계: Facebook 로그인 제품 추가

1. 앱 대시보드에서 **제품 추가** 클릭
2. **Facebook 로그인** 선택 → **설정** 클릭
3. **Facebook 로그인** → **설정** 메뉴로 이동

### 3단계: OAuth 리디렉션 URI 설정

**유효한 OAuth 리디렉션 URI**에 다음 URL들을 추가:

```
https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

**예시:**
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

> **참고**: `[YOUR_SUPABASE_PROJECT_ID]`는 Supabase 프로젝트 URL에서 확인할 수 있습니다.
> 예: `https://abcdefghijklmnop.supabase.co` → 프로젝트 ID는 `abcdefghijklmnop`

### 4단계: Facebook 앱 ID와 시크릿 키 확인

1. Facebook 앱 대시보드에서 **설정** → **기본 설정** 이동
2. 다음 정보를 복사:
   - **앱 ID** (App ID)
   - **앱 시크릿** (App Secret) - "표시" 클릭하여 확인

### 5단계: Supabase에 Facebook OAuth 설정

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택 → **Authentication** → **Providers** 메뉴
3. **Facebook** 찾아서 활성화
4. 다음 정보 입력:
   - **Client ID (for OAuth)**: Facebook 앱 ID
   - **Client Secret (for OAuth)**: Facebook 앱 시크릿
5. **저장** 클릭

### 6단계: Facebook 앱 설정 확인

Facebook 앱 대시보드에서:

1. **앱 검토** → **권한 및 기능** 확인
   - `public_profile`: 기본 제공 (자동 승인)
   - `email`: 기본 제공 (자동 승인)

2. **앱 검토** → **앱 검토 모드** 확인
   - 개발 중: **앱 검토 모드 OFF** (테스트 사용자만 사용 가능)
   - 프로덕션: **앱 검토 모드 OFF** + 앱 검토 완료 (모든 사용자 사용 가능)

### 7단계: 테스트 사용자 추가 (개발 단계)

앱 검토 모드가 켜져 있는 경우:

1. Facebook 앱 대시보드 → **역할** → **역할** 탭
2. **테스트 사용자 추가** 클릭
3. 테스트할 Facebook 계정 추가

## ✅ 테스트 방법

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 브라우저에서 `http://localhost:3000/login` 접속

3. **"Facebook으로 계속하기"** 버튼 클릭

4. Facebook 로그인 화면에서 로그인

5. 권한 승인 후 리디렉션 확인

## 🔍 문제 해결

### "리디렉션 URI 불일치" 오류

**원인**: Facebook에 등록된 리디렉션 URI와 실제 사용하는 URI가 일치하지 않음

**해결책**:
1. Facebook 앱 설정 → **Facebook 로그인** → **설정**
2. **유효한 OAuth 리디렉션 URI**에 정확한 Supabase 콜백 URL 추가
3. URL 끝에 슬래시(`/`)가 있는지 확인

### "앱이 비활성화되었습니다" 오류

**원인**: Facebook 앱이 개발 모드이고 테스트 사용자가 아님

**해결책**:
1. Facebook 앱 대시보드 → **역할** → **역할**
2. 테스트 사용자로 본인 계정 추가
3. 또는 앱 검토 모드 끄기 (프로덕션 배포 시)

### "이메일 권한이 없습니다" 오류

**원인**: Facebook 계정에 이메일이 연결되어 있지 않거나 권한이 거부됨

**해결책**:
1. Facebook 계정 설정에서 이메일 확인
2. 로그인 시 이메일 권한 승인

### Supabase에서 "Provider not enabled" 오류

**원인**: Supabase에서 Facebook 프로바이더가 활성화되지 않음

**해결책**:
1. Supabase Dashboard → **Authentication** → **Providers**
2. Facebook 프로바이더 활성화 및 설정 확인

## 📝 코드 확인

현재 구현된 코드 위치:

- **로그인 페이지**: `src/app/login/page.tsx` (215-225줄)
- **로그인 액션**: `src/app/login/actions.ts` (129-156줄)
- **콜백 처리**: `src/app/auth/callback/route.ts`

코드는 이미 구현되어 있으므로 위 설정만 완료하면 바로 사용할 수 있습니다.

## 🚀 프로덕션 배포 시 주의사항

1. **앱 검토 제출**: Facebook 앱 검토를 완료하여 모든 사용자가 사용할 수 있도록 설정
2. **프로덕션 URL 추가**: 프로덕션 도메인의 리디렉션 URI를 Facebook에 추가
3. **환경 변수**: 프로덕션 환경의 Supabase URL이 올바르게 설정되어 있는지 확인

## 📚 참고 자료

- [Supabase OAuth 가이드](https://supabase.com/docs/guides/auth/social-login/auth-facebook)
- [Facebook 로그인 문서](https://developers.facebook.com/docs/facebook-login)
- [Facebook 앱 검토 가이드](https://developers.facebook.com/docs/app-review)





