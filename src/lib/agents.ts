import { Camera, ClipboardList, Clock3, CloudRain, ScanSearch, ShieldAlert, Store, Stethoscope, TrendingUp, Wind, type LucideIcon } from 'lucide-react';

/** 三大专家智能体的女娲平台 Agent ID */
export type AgentKey = 'warning' | 'diagnosis' | 'sales';

export interface AgentHighlight {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface AgentConfig {
  key: AgentKey;
  /** 女娲平台智能体 ID（创建会话时携带） */
  id: number;
  /** 完整专家名（对话面板头部展示） */
  name: string;
  /** 短名（Tab 与文案用） */
  shortName: string;
  icon: LucideIcon;
  /** 主题色：Tab 选中态、身份卡头像、能力卡强调 */
  accent: string;
  /** 主题色浅底 */
  soft: string;
  /** 一句话能力（动态副标题 / 身份卡第二行） */
  tagline: string;
  /** 欢迎语（该智能体会话的开场消息） */
  welcome: string;
  /** 输入框占位提示 */
  placeholder: string;
  /** 会话列表标题的兜底取名 */
  fallbackTitle: string;
  /** 页底三项能力亮点 */
  highlights: AgentHighlight[];
}

export const AGENTS: AgentConfig[] = [
  {
    key: 'warning',
    id: 33293229,
    name: '农业智能预警专家',
    shortName: '预警',
    icon: CloudRain,
    accent: '#e8a83e',
    soft: '#fff6e3',
    tagline: '天气、灾害与病虫害迁飞，提前一步提醒到田',
    welcome:
      '你好，我是**农业智能预警专家**。降雨、气温、灾害性天气和病虫害迁飞，我替你盯着每一块田——把提醒送达在风险来临之前。直接告诉我你所在的地区和作物即可。',
    placeholder: '问预警专家，如「明天有雨吗」',
    fallbackTitle: '天气预警咨询',
    highlights: [
      { icon: CloudRain, title: '气象实况与预报研判', desc: '温、雨、风、墒实时数据加未来趋势，把农事窗口算清楚。' },
      { icon: ShieldAlert, title: '灾害天气提前预警', desc: '暴雨、台风、寒潮、干热风，风险来临前送达可执行提醒。' },
      { icon: Wind, title: '病虫害迁飞趋势提示', desc: '结合物候与气流趋势，提示迁飞路径与田间高发风险。' },
    ],
  },
  {
    key: 'diagnosis',
    id: 33292926,
    name: '农业智能诊断专家',
    shortName: '诊断',
    icon: ScanSearch,
    accent: '#2d7a4f',
    soft: '#eaf3e8',
    tagline: '拍一张叶片照片，秒级读懂病虫害与缺素',
    welcome:
      '你好，我是**农业智能诊断专家**。拍一张叶片照片发我（顺光、对焦清楚、带 1–2 片健康叶对比），病虫害、缺素、药害我来判断，并给出可以直接下地的防治方案。',
    placeholder: '描述作物症状，或直接拍照上传',
    fallbackTitle: '拍照诊断',
    highlights: [
      { icon: Camera, title: '拍照识别病虫害', desc: '上传叶片或果实照片，秒级给出初步判断与置信依据。' },
      { icon: Stethoscope, title: '病害缺素逐项鉴别', desc: '真菌、细菌、缺素、药害，逐项排查并说清判断依据。' },
      { icon: ClipboardList, title: '可执行的防治方案', desc: '用药、间隔、复查节点，一步步照着做，不怕记不住。' },
    ],
  },
  {
    key: 'sales',
    id: 33293230,
    name: '农产品智能销售专家',
    shortName: '销售',
    icon: TrendingUp,
    accent: '#8b5e3c',
    soft: '#f5ede4',
    tagline: '行情、时机与渠道，算准每一次出手',
    welcome:
      '你好，我是**农产品销售专家**。把品种、数量和所在地区告诉我，我帮你对比行情走势、判断出手时机、比较渠道差价，把好收成变成好收入。',
    placeholder: '问销售专家，如「现在适合卖玉米吗」',
    fallbackTitle: '行情销售咨询',
    highlights: [
      { icon: TrendingUp, title: '产地行情对比', desc: '近期均价走势与收购报价横向对比，找到相对高位。' },
      { icon: Clock3, title: '出手时机判断', desc: '结合库存成本与回款压力，给出「卖」还是「等」的建议。' },
      { icon: Store, title: '多渠道比价', desc: '粮库、油厂直采、经纪人、电商，几条线同时比价。' },
    ],
  },
];

export const AGENT_KEYS: AgentKey[] = AGENTS.map((a) => a.key);

export const AGENT_MAP: Record<AgentKey, AgentConfig> = AGENTS.reduce(
  (acc, a) => ({ ...acc, [a.key]: a }),
  {} as Record<AgentKey, AgentConfig>,
);

/** 进入「智能助手」页默认激活的智能体：首页唯一深链（科学诊断 → /assistant）指向诊断，且拍照诊断是赛道核心演示 */
export const DEFAULT_AGENT: AgentKey = 'diagnosis';
