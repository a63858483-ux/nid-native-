import { File, Paths } from 'expo-file-system';

import { call } from './api';

// His purchase cards ([pay:{"request_id"}]). Amounts are whole fen. The one-time nonce is handed out
// once (claim=1) and only lets her approve this exact snapshot, so it is kept on the phone.
export type Pay = {
  request_id: string;
  status: string;
  total: number;
  subtotal?: number;
  shipping?: number | null;
  discount?: number;
  discount_label?: string;
  goods?: string;
  spec?: string;
  qty?: number;
  platform?: string;
  merchant?: string;
  method?: string;
  address?: string;
  reason?: string;
  fingerprint: string;
  fingerprint_short?: string;
  expires_in: number;
  auto?: boolean;
  error_code?: string | null;
  nonce?: string;
};

const file = () => new File(Paths.document, 'pay-nonces.json');
let nonces: Record<string, string> | null = null;
function book(): Record<string, string> {
  if (nonces) return nonces;
  try {
    const f = file();
    nonces = f.exists ? (JSON.parse(f.textSync()) as Record<string, string>) : {};
  } catch {
    nonces = {};
  }
  return nonces;
}
export const nonceOf = (id: string) => book()[id];

export async function get(id: string): Promise<Pay> {
  const have = !!nonceOf(id);
  const d = (await call(`/api/payments/${encodeURIComponent(id)}${have ? '' : '?claim=1'}`)) as Pay;
  if (d.nonce) {
    book()[id] = d.nonce;
    try {
      file().write(JSON.stringify(book()));
    } catch {}
  }
  return d;
}

const post = (id: string, path: string, body: unknown = {}) =>
  call(`/api/payments/${encodeURIComponent(id)}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) as Promise<Pay>;
export const approve = (p: Pay) => post(p.request_id, 'approve', { nonce: nonceOf(p.request_id) ?? '', fingerprint: p.fingerprint });
export const reject = (p: Pay) => post(p.request_id, 'reject');

export const yuan = (fen: number) => (Math.round(fen) / 100).toFixed(2);
export const LIVE = new Set(['approved', 'executing', 'pending_alipay']);
export const STATE: Record<string, string> = {
  pending_approval: '等你确认',
  approved: '已确认，去付款了',
  executing: '正在付款…',
  pending_alipay: '等你在支付宝里确认',
  paid: '已付款',
  completed: '已付款',
  rejected: '没要',
  cancelled: '取消了',
  expired: '已作废',
  failed: '付款失败',
  budget_blocked: '超出预算',
};
