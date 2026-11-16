import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ChatInterface from '@/components/assistant/ChatInterface';
import { initialSlots, useChatStore } from '@/store/chatStore';
import * as nuwax from '@/lib/nuwax';

// 只 mock 网络边界，组件与 store 走真实实现
vi.mock('@/lib/nuwax', () => ({
  isNuwaxConfigured: true,
  createConversation: vi.fn(async () => 42),
  streamChat: vi.fn(),
  uploadFile: vi.fn(),
  getMessages: vi.fn(async () => []),
}));

const streamChat = vi.mocked(nuwax.streamChat);

// jsdom 缺失的浏览器 API（framer-motion / scrollIntoView 依赖）
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }) as MediaQueryList;
  }
  if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(cb, 0) as unknown as number;
  if (!window.cancelAnimationFrame) window.cancelAnimationFrame = (id) => clearTimeout(id);
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  if (!URL.createObjectURL) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:leaf-preview' });
  if (!URL.revokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:leaf-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  useChatStore.getState().stopGeneration();
  localStorage.clear();
  useChatStore.setState({
    activeAgent: 'diagnosis',
    slots: initialSlots(),
    isThinking: false,
    streamingAgent: null,
    status: '',
    pendingQueue: [],
    uploadingCount: 0,
  });
});

afterEach(() => useChatStore.getState().stopGeneration());

describe('ChatInterface 思考态', () => {
  it('展示当前阶段进度文案', () => {
    useChatStore.setState({ isThinking: true, streamingAgent: 'diagnosis', status: '正在检索知识库…' });
    render(<ChatInterface />);
    expect(screen.queryByText('正在检索知识库…')).not.toBeNull();
  });

  it('isThinking 时仍可发送，消息入队而非阻断', async () => {
    useChatStore.setState({ isThinking: true, streamingAgent: 'diagnosis' });
    render(<ChatInterface />);

    const textarea = screen.getByPlaceholderText(/描述作物症状/);
    fireEvent.change(textarea, { target: { value: '第二个问题' } });

    const sendBtn = screen.getByRole('button', { name: '发送消息' });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(sendBtn);
    });

    const msgs = useChatStore.getState().slots.diagnosis.messages;
    expect(msgs[msgs.length - 1].content).toBe('第二个问题');
    expect(useChatStore.getState().pendingQueue).toHaveLength(1);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('别的智能体在生成时，当前视图不显示等待动画', () => {
    useChatStore.setState({ isThinking: true, streamingAgent: 'warning', status: '正在检索知识库…' });
    render(<ChatInterface />);
    expect(screen.queryByText('正在检索知识库…')).toBeNull();
  });
});

describe('ChatInterface：三专家智能体界面', () => {
  it('身份卡展示当前智能体（默认诊断专家），不再是笼统的「农智通智能体」', () => {
    render(<ChatInterface />);

    // 限定 p：欢迎语里的 **加粗专家名** 也会渲染同样文字，但那是 strong 不是身份卡
    expect(screen.queryByText('农业智能诊断专家', { selector: 'p' })).not.toBeNull();
    expect(screen.queryByText('农智通智能体')).toBeNull();
  });

  it('切换智能体后，身份卡与占位提示全部跟随', async () => {
    render(<ChatInterface />);
    expect(screen.queryByPlaceholderText(/描述作物症状/)).not.toBeNull();

    await act(async () => {
      useChatStore.getState().setActiveAgent('warning');
    });

    expect(screen.queryByText('农业智能预警专家', { selector: 'p' })).not.toBeNull();
    expect(screen.queryByPlaceholderText(/问预警专家/)).not.toBeNull();
  });
});

describe('ChatInterface：附件失败状态', () => {
  it('上传失败时显示失败状态并禁用发送', async () => {
    vi.mocked(nuwax.uploadFile).mockRejectedValueOnce(new Error('上传失败'));
    render(<ChatInterface />);

    const file = new File(['leaf'], '叶片.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText('上传失败，请重试')).not.toBeNull();
    expect((screen.getByRole('button', { name: '发送消息' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('失败附件重试成功后才允许携带文件 key 发送', async () => {
    vi.mocked(nuwax.uploadFile)
      .mockRejectedValueOnce(new Error('上传失败'))
      .mockResolvedValueOnce({ key: 'leaf-key', url: '/leaf.png', fileName: '叶片.png', mimeType: 'image/png' });
    render(<ChatInterface />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['leaf'], '叶片.png', { type: 'image/png' })] } });
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '重试上传 叶片.png' })));
    expect(screen.queryByText('上传失败，请重试')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '发送消息' })));
    expect(streamChat.mock.calls[0][2][0].fileKey).toBe('leaf-key');
  });

  it('批量文件尚未全部上传时不能发送', async () => {
    let resolveSecond!: (file: nuwax.UploadedFile) => void;
    vi.mocked(nuwax.uploadFile)
      .mockResolvedValueOnce({ key: 'first', url: '/a.png', fileName: 'a.png', mimeType: 'image/png' })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<ChatInterface />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })] } });
    });
    expect((screen.getByRole('button', { name: '发送消息' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolveSecond({ key: 'second', url: '/b.png', fileName: 'b.png', mimeType: 'image/png' }));
    expect((screen.getByRole('button', { name: '发送消息' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
