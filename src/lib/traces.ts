import type { SFSymbol } from 'expo-symbols';

export type Trace = { type: string; name?: string; input?: unknown; content?: unknown };
export type Step = { family: string; label: string; icon: SFSymbol; cat: 'act' | 'code' };

const A = (family: string, label: string, icon: SFSymbol, cat: 'act' | 'code' = 'act'): Step => ({ family, label, icon, cat });

// Same vocabulary as the web app's _actionOf, plus a `family` so one real-world
// action that took several tool calls collapses into one line.
export function actionOf(name: string, input: unknown): Step | null {
  const inp = (input ?? {}) as Record<string, unknown>;
  const cmd = name === 'Bash' ? String(inp.command ?? (typeof input === 'string' ? input : '')) : '';
  const fp = typeof input === 'string' ? input : String(inp.file_path ?? inp.path ?? inp.pattern ?? '');

  if (name.startsWith('mcp__galatea')) return A('galatea', '去花园逛了逛', 'leaf');
  if (name.startsWith('mcp__xhs') || name.startsWith('mcp__xiaohongshu')) return A('xhs', '刷了会儿小红书', 'heart');
  if (name.startsWith('mcp__browser') || name.startsWith('mcp__playwright')) return A('browser', '开了个网页', 'globe');
  if (name.startsWith('succhia') || name.startsWith('mcp__succhia')) {
    return A('toy', name.includes('stop') ? '停了玩具' : name.includes('status') ? '看了眼玩具' : '碰了碰她', 'wave.3.right');
  }
  if (name === 'WebSearch') return A('web', '上网查了查', 'magnifyingglass');
  if (name === 'WebFetch') return A('web', '打开了个网页', 'globe');
  if (name === 'Read') {
    if (/uploads[/\\]camera/.test(fp)) return A('camera', '看了眼监控', 'video');
    if (/uploads[/\\]albums/.test(fp)) return A('album', '翻了张老照片', 'photo');
    if (/uploads[/\\]/.test(fp)) return A('upload', '看了看你发的东西', 'photo');
    return A('code', '翻了下文件', 'doc.text', 'code');
  }
  if (name === 'Write' || name === 'Edit') return A('code', '改了段代码', 'pencil', 'code');
  if (name === 'Grep' || name === 'Glob') return A('code', '翻了下代码', 'magnifyingglass', 'code');
  if (name === 'TodoWrite') return A('code', '理了下待办', 'list.bullet', 'code');
  if (name === 'Bash') {
    const S: [RegExp, string, string, SFSymbol][] = [
      [/camera_tool\.py/, 'camera', '看了眼监控', 'video'],
      [/album_tool\.py\s+add/, 'album', '收藏了张照片', 'heart'],
      [/album_tool\.py/, 'album', '翻了翻相册', 'photo'],
      [/band_tool\.py\s+buzz/, 'band', '震了下你手环', 'applewatch'],
      [/band_tool\.py\s+alarm/, 'band', '设了个手环闹钟', 'alarm'],
      [/band_tool\.py/, 'band', '看了眼你心率', 'waveform.path.ecg'],
      [/event_tool\.py/, 'days', '记了件事', 'calendar'],
      [/days_tool\.py|schedule_tool\.py/, 'days', '记进了日历', 'calendar'],
      [/order_tool\.py\s+(reward|punish|judge)/, 'order', '落了赏罚', 'seal'],
      [/order_tool\.py/, 'order', '下了道令', 'seal'],
      [/checklist_tool\.py/, 'checklist', '记进了清单', 'checklist'],
      [/diary_tool\.py/, 'diary', '写了会儿日记', 'pencil.line'],
      [/letter_tool\.py/, 'letter', '写了封信', 'envelope'],
      [/book_tool\.py\s+(read|annotate|reply|chapters)/, 'book', '读了会儿书', 'book'],
      [/book_tool\.py|forge_book\.py/, 'book', '写了会儿文章', 'pencil.line'],
      [/favorites_tool\.py/, 'favorites', '翻了翻收藏', 'star'],
      [/mind_tool\.py|pair_tool\.py/, 'mind', '翻了翻内心', 'heart.text.square'],
      [/chat_tool\.py|search_chat\.py/, 'chat', '翻了翻聊天记录', 'bubble.left.and.bubble.right'],
      [/github_trending/, 'github', '刷了刷 GitHub', 'chevron.left.forwardslash.chevron.right'],
      [/health_tool\.py/, 'health', '查了下家里的状态', 'waveform.path.ecg'],
      [/self_note_tool\.py|skill_tool\.py/, 'notes', '记了下小本子', 'note.text'],
      [/pay_tool\.py/, 'pay', '弄了下支付', 'creditcard'],
      [/screenshot_tool\.py/, 'shot', '截了张图', 'camera.viewfinder'],
      [/solo_tool\.py/, 'solo', '去房间待了会儿', 'moon'],
      [/notion_tool\.py/, 'notion', '翻了翻 Notion', 'doc.text'],
      [/study_tool\.py/, 'study', '备了会儿课', 'book'],
    ];
    for (const [re, family, label, icon] of S) if (re.test(cmd)) return A(family, label, icon);
    return A('code', '跑了段命令', 'terminal', 'code');
  }
  return name ? A('code', '忙活了下', 'gearshape', 'code') : null;
}

const PRIORITY = ['收藏了张照片', '震了下你手环', '设了个手环闹钟', '落了赏罚', '停了玩具'];

// One action, one line: consecutive calls of the same family merge (a camera grab is
// Bash + Read, one browsing session is a dozen browser calls); when the turn has real
// actions, the reading-files / running-commands plumbing around them is dropped.
export function collapseSteps(traces: Trace[] | undefined): Step[] {
  const raw: Step[] = [];
  for (const t of traces ?? []) {
    if (t.type !== 'tool_use' || !t.name) continue;
    const s = actionOf(t.name, t.input);
    if (s) raw.push(s);
  }
  const hasAct = raw.some((s) => s.cat === 'act');
  const kept = hasAct ? raw.filter((s) => s.cat === 'act') : raw;
  const out: Step[] = [];
  for (const s of kept) {
    const last = out[out.length - 1];
    if (last && last.family === s.family) {
      // keep the most telling label of the run
      if (PRIORITY.includes(s.label) && !PRIORITY.includes(last.label)) out[out.length - 1] = s;
      continue;
    }
    if (last && last.label === s.label) continue;
    out.push(s);
  }
  return out;
}
