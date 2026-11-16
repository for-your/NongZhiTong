import { motion } from 'framer-motion';
import { ArrowRight, Compass, Cpu, Eye, HeartHandshake, Lightbulb, Sprout, Target, Wheat } from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import AnimatedSection from '@/components/ui/AnimatedSection';
import PillButton from '@/components/ui/PillButton';

const values = [
  { icon: Target, title: '从真实问题出发', text: '不为了展示技术而堆技术，只解决农业生产中真正让人困扰的问题。' },
  { icon: Eye, title: '让判断更透明', text: '每一个建议都说明为什么，不把结论藏在黑箱里。' },
  { icon: HeartHandshake, title: '和人一起成长', text: '我们相信最好的农业智能，来自技术与一线经验的共同迭代。' },
  { icon: Lightbulb, title: '把复杂变简单', text: '少一些术语和配置，多一些今天就可以做的清晰行动。' },
];

const milestones = [
  { step: '01', title: '看见真实的问题', text: '从农业生产里最常见的困扰出发：叶片异常看不懂、天气变化跟不紧、收获之后卖不掉。' },
  { step: '02', title: '第一位诊断专家', text: '把作物症状问询做成可以对话的智能体，先让「拍一张照片就开始判断」成立。' },
  { step: '03', title: '预警与销售补全链路', text: '诊断之外，接入天气提醒与行情思路，让三个环节连成一个完整的决策空间。' },
  { step: '04', title: '知识空间成型', text: '把过程里的经验整理成主题笔记，让每一次提问之外，还能系统地学习。' },
];

const team = [
  { icon: Compass, role: '产品与体验', text: '把复杂的农业判断，翻译成清晰易用的产品语言。', tags: ['需求梳理', '交互设计'] },
  { icon: Cpu, role: 'AI 与数据', text: '让模型能力真正落到田间的具体问题上，而不是停留在演示。', tags: ['智能体搭建', '提示工程'] },
  { icon: Wheat, role: '农业顾问', text: '用一线种植经验校准每一个建议，保证说得出口、下得了地。', tags: ['农事校准', '知识整理'] },
];

export default function About() {
  return <PageTransition>
    <main className="bg-paper">
      {/* 使命宣言横幅：页面首个模块，整幅图片贴到页面最顶端（与首页 Hero 一致），
          导航栏是带底色的固定胶囊，直接浮在图上 */}
      <section className="relative min-h-[500px] overflow-hidden">
        <img src="https://images.pexels.com/photos/4975379/pexels-photo-4975379.jpeg?auto=compress&cs=tinysrgb&w=1600" alt="农技人员在向日葵田里对照平板记录作物长势" className="absolute inset-0 h-full w-full object-cover object-top" />
        {/* 纵向渐变托底：横幅是超宽裁切（约 2.88:1），横向遮罩会把左侧的人物压进暗部，
            改成「下深上透」既保证左下宣言可读，又让老农与向日葵留在亮部 */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/95 via-brand-deep/50 to-transparent" />
        <div className="relative mx-auto flex min-h-[500px] max-w-7xl items-end px-5 pb-16 lg:px-8">
          <p className="max-w-2xl font-display text-h1 font-bold leading-tight tracking-[-.015em] text-white">
            技术不是为了替代经验，<br />
            <span className="text-brand-tint">而是让经验走得更远。</span>
          </p>
        </div>
      </section>

      {/* Hero：宣言 + 数据背书 */}
      <section className="px-5 pb-20 pt-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-end gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[.2em] text-brand">About Agrismart</p>
            <h1 className="mt-5 font-display text-display font-bold leading-[1.02] tracking-[-.02em] text-ink">
              我们相信，<br />
              <span className="text-brand">土地值得被理解。</span>
            </h1>
          </div>
          <div>
            <p className="max-w-md text-base leading-8 text-muted">
              农智通是一个面向农业从业者的 AI 工作空间，由一支小而认真的团队从零打磨。我们正在做的事很简单：用 AI 帮助更多人更从容地面对农业里的每一个不确定。
            </p>
            <div className="mt-9 grid max-w-md grid-cols-1 gap-x-6 gap-y-4 border-t border-faint pt-8 sm:grid-cols-2 lg:max-w-none">
              {[
                { icon: Target, title: '智能预警', text: '天气与病虫害风险，先一步提醒' },
                { icon: Eye, title: '科学诊断', text: '一张照片，开始作物症状判断' },
                { icon: HeartHandshake, title: '合理销售', text: '行情、时机与渠道的建议' },
                { icon: Lightbulb, title: '知识空间', text: '持续更新的主题农事笔记' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
                    <item.icon className="h-5 w-5 text-brand" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 价值观 */}
      <section className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <AnimatedSection>
            <p className="text-caption font-semibold uppercase tracking-[.2em] text-brand">What guides us</p>
            <h2 className="mt-4 max-w-2xl font-display text-h1 font-bold leading-tight tracking-[-.015em] text-ink">
              我们的价值观，<br />写在每一次产品选择里。
            </h2>
          </AnimatedSection>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <motion.div key={value.title} whileHover={{ y: -6 }} className="rounded-2xl border border-faint bg-white p-6 transition-shadow hover:shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint">
                  <value.icon className="h-6 w-6 text-brand" />
                </span>
                <h3 className="mt-6 text-lg font-bold text-ink">{value.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{value.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 项目里程碑：竖线 + 节点 */}
      <section className="relative bg-brand-deep px-5 py-24 text-white lg:px-8">
        <div className="grain-overlay" />
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-caption font-semibold uppercase tracking-[.2em] text-gold">Milestones</p>
              <h2 className="mt-4 font-display text-h1 font-bold tracking-[-.015em]">
                一步一步，<br />走到田里。
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-white/55">从一个想法到可演示的产品，每一步都围绕真实的农事需求推进。</p>
            </div>
            <div className="relative space-y-12 border-l border-white/15 pl-8 sm:pl-10">
              {milestones.map((item) => (
                <motion.div key={item.step} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
                  <span className="absolute -left-[41px] top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-gold bg-brand-deep sm:-left-[49px]" />
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-xl font-black text-gold">{item.step}</span>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                  </div>
                  <p className="mt-2.5 max-w-lg text-sm leading-7 text-white/60">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 团队分工 */}
      <section className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <AnimatedSection>
            <p className="text-caption font-semibold uppercase tracking-[.2em] text-brand">The team</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-.07em] text-ink md:text-6xl">一支小而认真的团队。</h2>
          </AnimatedSection>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {team.map((member, index) => (
              <div key={member.role} className="group overflow-hidden rounded-3xl bg-white transition-shadow hover:shadow-lg">
                <div className={`flex h-40 items-center justify-between px-8 ${index === 0 ? 'bg-brand-tint' : index === 1 ? 'bg-gold-soft' : 'bg-paper-warm'}`}>
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/70 bg-white/60 text-brand-deep transition duration-500 group-hover:scale-110">
                    <member.icon className="h-9 w-9" />
                  </span>
                  <Sprout className="h-6 w-6 text-brand-deep/30 transition duration-500 group-hover:rotate-[-12deg] group-hover:text-brand-deep/60" />
                </div>
                <div className="p-6">
                  <p className="text-xl font-bold text-ink">{member.role}</p>
                  <p className="mt-3 text-sm leading-6 text-muted">{member.text}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {member.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-faint px-3 py-1 text-caption font-semibold text-muted transition group-hover:border-brand-line group-hover:text-brand">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gold px-5 py-20 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <Sprout className="h-8 w-8 text-brand-deep" />
            <h2 className="mt-5 font-display text-h2 font-bold tracking-[-.015em] text-ink">
              一起，让农业的未来<br />更有答案。
            </h2>
          </div>
          <PillButton href="/assistant" variant="primary">和我们一起开始 <ArrowRight className="h-4 w-4" /></PillButton>
        </div>
      </section>
    </main>
  </PageTransition>;
}
