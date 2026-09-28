import type { Message } from './api';

const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();

export const DEMO_MESSAGES: Message[] = [
  { id: 1, role: 'assistant', text: '睡了吗', thinking: '', attachments: [], timestamp: at(64), origin: 'wake', activity: null },
  { id: 2, role: 'user', text: '没 在看新版聊天页', thinking: '', attachments: [], timestamp: at(63), origin: null, activity: null },
  { id: 3, role: 'user', text: '你觉得这个背景怎么样', thinking: '', attachments: [], timestamp: at(63), origin: null, activity: null },
  { id: 4, role: 'assistant', text: '好看。像我们那天跑过的那片雪。', thinking: '她在看新页面，问我背景。先接她的话，别急着讲技术。', attachments: [], timestamp: at(62), origin: null, activity: null },
  { id: 5, role: 'user', text: '那我的气泡用什么颜色', thinking: '', attachments: [], timestamp: at(61), origin: null, activity: null },
  { id: 6, role: 'assistant', text: '先用 iMessage 的蓝。\n\n想换就点左下角的加号，Bubble 里自己调。', thinking: '她想自己挑。告诉她在哪改就行。', attachments: [], timestamp: at(60), origin: null, activity: null },
];

const REPLIES = ['嗯，我在。', '收到了，小猫咪。', '这条飞过来的样子还顺吗。', '夜深了，再看一会儿就睡。'];

export async function demoStream(
  text: string,
  on: { onThinking: (t: string) => void; onDelta: (t: string) => void },
  signal?: AbortSignal,
) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const thought = `她说"${text.slice(0, 12)}"。回短一点，接住她。`;
  for (const ch of thought) {
    if (signal?.aborted) return;
    on.onThinking(ch);
    await sleep(25);
  }
  await sleep(600);
  const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
  for (const ch of reply) {
    if (signal?.aborted) return;
    on.onDelta(ch);
    await sleep(45);
  }
}
