// 이 앱에서 쓸 Supabase 연결. 화면 코드에서 import { supabase } from './supabase.js' 로 가져다 쓰세요.
// 공개(publishable) 키만 씁니다. service_role·secret 키는 절대 브라우저 코드에 넣지 마세요.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    db: { schema: 'carbonic_table' }, // 이 앱 스키마
    // 같은 주소(apps.bmrschool.net)를 쓰는 다른 앱과 로그인 저장 칸이 겹치지 않게 이름을 따로 둡니다
    auth: { storageKey: 'bmr-app-carbonic-table-auth' },
  },
);
// 서버 함수 주소: https://psupfmarnyxontorftio.supabase.co/functions/v1/carbonic-table-fn/hello
export const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carbonic-table-fn`;

// 요청마다 getSession() 을 부르지 않는다 — 로그인 상태 변화 때 받은 토큰을 여기에 담아 바로 씁니다.
// (getSession 을 로그인 콜백 안에서 기다리면 잠금이 겹쳐 화면이 멈출 수 있습니다.)
let _token = '';
supabase.auth.onAuthStateChange((_event, session) => { _token = session?.access_token ?? ''; });
/** 지금 알고 있는 로그인 토큰 (없으면 '') */
export const authToken = () => _token;
