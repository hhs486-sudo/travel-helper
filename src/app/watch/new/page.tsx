import type { Metadata } from 'next';
import WatchItemForm from '@/components/watch/WatchItemForm';

export const metadata: Metadata = {
  title: '관심 여행지 등록 | Travel Helper',
  description: '여행지와 조건을 설정하면 가격 변동을 실시간으로 알려드려요.',
};

/**
 * 관심 여행지(WatchItem) 등록 페이지
 * - 서버 컴포넌트 래퍼: metadata 설정 + 레이아웃 역할
 * - 실제 폼 로직은 WatchItemForm (클라이언트 컴포넌트) 에서 처리
 */
export default function WatchNewPage() {
  return <WatchItemForm />;
}
