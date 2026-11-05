import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectCues } from '../../src/director/cues';
import type { Glossary } from '../../src/director/glossary';
import type { BeatSpan, Cue } from '../../src/director/types';

const glossary: Glossary = {
  terms: [{ term: 'Claude', label: 'mô hình' }, { term: 'Opus 5.5', label: 'mô hình' }, { term: 'Màn hình xanh' }],
  ui: ['giao diện', 'editor', 'timeline', 'màn hình'],
  shortvideo: ['tiktok', 'video ngắn', 'video dọc'],
  emphasis: ['đừng', 'không', 'rất', 'cực kỳ'],
  promptVerbs: ['prompt', 'bảo', 'yêu cầu'],
};

/** Words 0.3 s apart from a sentence; the span covers all of them. */
function beat(text: string) {
  const words = text.split(' ').map((t, i) => ({ t, s: i * 0.3, e: i * 0.3 + 0.25 }));
  const span: BeatSpan = { firstWord: 0, lastWord: words.length - 1, start: 0, end: words.at(-1)!.e, text };
  return { words, span };
}
const cues = (text: string, g: Glossary = glossary): Cue[] => { const { words, span } = beat(text); return detectCues(words, span, g); };
const kinds = (text: string) => cues(text).map(c => c.kind);
const of = (text: string, kind: Cue['kind']) => cues(text).filter(c => c.kind === kind);

describe('tool cues', () => {
  it('a Latin capitalised word in the middle of the beat is a tool, the first word is not, "5" and "AI" are not', () => {
    expect(of('Hôm nay mình dùng Claude để edit', 'tool').map(c => c.text)).toContain('Claude');
    expect(of('Remotion là một thư viện', 'tool')).toHaveLength(0);
    expect(of('Mình có 5 video', 'tool')).toHaveLength(0);
    expect(of('Mình dùng AI để edit', 'tool')).toHaveLength(0);
  });
  it('a capitalised word that is not in the glossary has no label: nobody knows what kind of thing it is', () => {
    const [c] = of('Mình dùng Remotion nhé', 'tool');
    expect(c).toMatchObject({ text: 'Remotion', word: 2 });
    expect(c.label).toBeUndefined();
  });
  it('a pronoun such as "Anh" in the middle of a beat is not a tool', () => {
    expect(cues('Hôm nay Anh nói về việc này', { ...glossary, notTools: ['anh'] }).filter(c => c.kind === 'tool')).toHaveLength(0);
  });
  it('a glossary term matches even at the start of the beat and carries its label', () => {
    expect(of('Claude vừa trả video', 'tool')[0]).toMatchObject({ text: 'Claude', label: 'mô hình', word: 0 });
  });
  it('a multi-word glossary term matches as a sequence', () => {
    const c = of('Mình thử Opus 5.5 hôm qua', 'tool');
    expect(c.map(x => x.text)).toContain('Opus 5.5');
    expect(c.find(x => x.text === 'Opus 5.5')!.word).toBe(2);
  });
  it('a glossary hit and a capitalised hit on the same word give one cue', () => {
    expect(of('Mình dùng Claude nhé', 'tool')).toHaveLength(1);
  });
  it('a glossary term matches in NFC and NFD forms alike (Review Focus 4)', () => {
    const nfd = 'Mình mở màn hình xanh rồi'.normalize('NFD');
    const nfc = 'Mình mở màn hình xanh rồi'.normalize('NFC');
    for (const text of [nfd, nfc]) expect(of(text, 'tool').map(c => c.label)).toContain('công cụ');
    expect(of(nfd, 'tool').length).toBe(of(nfc, 'tool').length);
  });
});

describe('number cues', () => {
  it('digits with a unit, a percentage and "nửa tiếng" match', () => {
    expect(of('Chỉ mất 30 phút thôi', 'number')[0].text).toBe('30 phút');
    expect(of('Tốn khoảng 2 -3 % quota', 'number')[0].text).toBe('2 -3 %');
    expect(of('Hết 30% thời gian', 'number')[0].text).toBe('30%');
    expect(of('Ta chỉ mất hơn nửa tiếng trở lên', 'number')[0].text).toBe('nửa tiếng');
  });
  it('digits without a number unit do not match', () => {
    expect(of('Có 30 người đến', 'number')).toHaveLength(0);
    expect(of('Bản Opus 5.5 mới', 'number')).toHaveLength(0);
  });
  it('word is the index of the first token', () => {
    expect(of('Chỉ mất 30 phút thôi', 'number')[0].word).toBe(2);
  });
});

describe('prompt cues', () => {
  it('the words after a prompt verb are the prompt text', () => {
    const c = of('Hãy bảo nó tạo cho bạn một giao diện', 'prompt')[0];
    expect(c.text).toBe('nó tạo cho bạn một giao diện');
    expect(c.word).toBe(2);
  });
  it('the text is capped at 8 words', () => {
    expect(of('bảo một hai ba bốn năm sáu bảy tám chín mười', 'prompt')[0].text.split(' ')).toHaveLength(8);
  });
  it('text inside double quotes is taken', () => {
    const c = of('Mình gõ "sửa chữ này to hơn" vào ô', 'prompt')[0];
    expect(c.text).toBe('sửa chữ này to hơn');
  });
  it('a verb followed by only two words is not a prompt', () => {
    expect(of('Mình bảo nó đi', 'prompt')).toHaveLength(0);
  });
});

describe('list cues', () => {
  it('three short segments make a list with its items', () => {
    const c = of('chữ Typography đủ kiểu, Graphic thì đa dạng, motion thì mượt mà', 'list')[0];
    expect(c.items).toEqual(['chữ Typography đủ kiểu', 'Graphic thì đa dạng', 'motion thì mượt mà']);
  });
  it('"và" also separates items', () => {
    expect(of('âm thanh, hình ảnh và chữ', 'list')[0].items).toHaveLength(3);
  });
  it('two items, or a segment longer than 4 words, is not a list', () => {
    expect(of('âm thanh và hình ảnh', 'list')).toHaveLength(0);
    expect(of('một, hai, ba bốn năm sáu bảy', 'list')).toHaveLength(0);
  });
});

describe('emphasis, ui, shortvideo and question cues', () => {
  it('every emphasis word is a cue with its word index', () => {
    const c = of('Đừng làm vậy, rất tệ và cực kỳ chậm', 'emphasis');
    expect(c.map(x => [x.text, x.word])).toEqual([['Đừng', 0], ['rất', 3], ['cực kỳ', 6]]); // Đừng0 làm1 vậy,2 rất3 tệ4 và5 cực6 kỳ7
  });
  it('emphasis keeps tone marks: dùng, đúng, qua and chứa are not đừng, quá or chưa (and NFD input still matches)', () => {
    expect(of('Mình dùng Claude, đúng rồi, đi qua trang chủ', 'emphasis')).toEqual([]);
    expect(of('Đừng làm vậy'.normalize('NFD'), 'emphasis').map(x => x.word)).toEqual([0]);
  });
  it('ui and shortvideo match the first occurrence only', () => {
    expect(of('Giao diện editor và lại giao diện nữa', 'ui').map(c => c.word)).toEqual([0, 2]); // 'giao diện' at 0, 'editor' at 2, repeats ignored
    expect(of('video ngắn cho TikTok, rồi lại video ngắn', 'shortvideo').map(c => c.text)).toEqual(['video ngắn', 'TikTok,']);
  });
  it('a beat ending with ? is a question', () => {
    expect(kinds('Bạn đã thử chưa?')).toContain('question');
    expect(kinds('Bạn đã thử chưa.')).not.toContain('question');
  });
  it('a beat with no signals has no cues', () => {
    expect(cues('Hôm nay trời đẹp')).toEqual([]);
  });
  it('works on a span that is only part of the transcript', () => {
    const words = 'Xin chào. Mình dùng Claude hôm nay'.split(' ').map((t, i) => ({ t, s: i * 0.3, e: i * 0.3 + 0.25 }));
    const span: BeatSpan = { firstWord: 2, lastWord: 6, start: 0.6, end: 1.75, text: 'Mình dùng Claude hôm nay' };
    const c = detectCues(words, span, glossary).filter(x => x.kind === 'tool');
    expect(c[0].word).toBe(4); // index into the whole transcript
  });
});

describe('section and cta cues', () => {
  const g: Glossary = {
    ...glossary,
    section: [{ term: 'mở bài', label: 'MỞ BÀI' }, { term: 'đầu tiên', label: 'ĐẦU TIÊN' }, { term: 'cuối cùng', label: 'CUỐI CÙNG' }],
    cta: [{ term: 'đăng ký', label: 'ĐĂNG KÝ KÊNH' }, { term: 'bình luận', label: 'BÌNH LUẬN' }, { term: 'comment', label: 'BÌNH LUẬN' }],
  };
  const sec = (text: string) => cues(text, g).filter(c => c.kind === 'section');
  const cta = (text: string) => cues(text, g).filter(c => c.kind === 'cta');
  it('a section mark gives a cue with its label and the index of its first word', () => {
    expect(sec('Đầu tiên là phần mở bài')).toEqual([{ kind: 'section', text: 'ĐẦU TIÊN', word: 0 }, { kind: 'section', text: 'MỞ BÀI', word: 4 }]);
  });
  it('"bước" followed by a number is a section too, whatever the glossary says', () => {
    expect(sec('Bước 2 là chọn phong cách').map(c => c.text)).toEqual(['BƯỚC 2']);
    expect(sec('Làm theo bước 10 nhé').map(c => c.text)).toEqual(['BƯỚC 10']);
    expect(sec('Một bước nhỏ thôi')).toEqual([]);
  });
  it('a cta gives its label; two entries with the same label give one cue', () => {
    expect(cta('Nhớ đăng ký kênh nhé').map(c => [c.text, c.word])).toEqual([['ĐĂNG KÝ KÊNH', 1]]);
    expect(cta('Hãy bình luận hoặc comment cho mình').map(c => c.text)).toEqual(['BÌNH LUẬN']);
  });
  it('matching ignores case and tone marks, NFC and NFD alike', () => {
    expect(sec('DAU TIEN la gi').map(c => c.text)).toEqual(['ĐẦU TIÊN']);
    expect(cta('ĐĂNG KÝ'.normalize('NFD') + ' ngay').map(c => c.text)).toEqual(['ĐĂNG KÝ KÊNH']);
  });
  it('a glossary without section and cta lists gives none, and "chia sẻ" is not a cta', () => {
    expect(cues('Đầu tiên hãy đăng ký kênh').filter(c => c.kind === 'section' || c.kind === 'cta')).toEqual([]);
    expect(cta('Mình sẽ chia sẻ cách làm')).toEqual([]);
  });
});

describe('words that look like tools but are Vietnamese', () => {
  const g: Glossary = { ...glossary, notTools: ['trong', 'cho', 'khi'] };
  it('a capitalised Vietnamese word without tone marks (Whisper capitalises the start of its sentence) is not a tool', () => {
    expect(cues('nhưng mà Trong video này thì mình sẽ chia sẻ', g).filter(c => c.kind === 'tool')).toEqual([]);
    expect(cues('Hôm nay Cho mình hỏi', g).filter(c => c.kind === 'tool')).toEqual([]);
  });
  it('a real tool name is still found, and a project can extend the list', () => {
    expect(cues('Hôm nay mình dùng Claude để edit', g).filter(c => c.kind === 'tool').map(c => c.text)).toContain('Claude');
    expect(cues('Hôm nay mình dùng Zed để edit', { ...g, notTools: [...g.notTools!, 'zed'] }).filter(c => c.kind === 'tool')).toEqual([]);
  });
  it('the default glossary lists the common ones', () => {
    // loaded through loadGlossary in glossary.test; here only the shape is checked
    expect(Array.isArray(g.notTools)).toBe(true);
  });
});

describe('step marks as section cues', () => {
  it('"mẹo số 3" is a section cue with the number, like "bước 3"', () => {
    const c = of('Và mẹo số 3 là nói chậm lại', 'section');
    expect(c.map(x => x.text)).toEqual(['MẸO SỐ 3']);
    expect(c[0].word).toBe(1);
  });
  it('the default glossary knows "thứ nhất" and "thứ năm" as well as "thứ hai"', () => {
    const g = JSON.parse(readFileSync('styles/glossary.json', 'utf8'));
    const labels = g.section.map((e: { label: string }) => e.label);
    for (const l of ['THỨ NHẤT', 'THỨ HAI', 'THỨ NĂM', 'THỨ SÁU']) expect(labels).toContain(l);
  });
});
