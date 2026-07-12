import { createHash } from 'crypto';
import { AnalysisResult, isLocalReleasePreparation, SourceRef } from './analyzer';
import { decideRoute, DecisionRoute } from './decision-engine';

export interface AlignmentDecision {
  schemaVersion: '1.0.0';
  kind: 'alignment.decision';
  policyVersion: '1.0.0';
  requestId: string;
  decisionId: string;
  route: DecisionRoute;
  reasons: string[];
  scores: { observed: AnalysisResult['observed']; effective: AnalysisResult['effective'] };
  claims: Array<Record<string, unknown>>;
  missing: string[];
  scope: { include: string[]; exclude: string[] };
  acceptance: Array<{ id: string; criterion: string; method: { kind: 'command' | 'manual'; value: string } }>;
  appliedContext?: SourceRef[];
  presentation: { mode: AnalysisResult['presentationMode']; tier: 'A' | 'B' | 'C' };
  next: Record<string, unknown>;
  lifecyclePlan: { baseline: 'required' | 'not_required'; completion: 'required' | 'not_observable'; precipitation: 'on_signal' };
  host: {
    adapter: string;
    level: 'L2' | 'L3';
    enforcement: { ingress: 'enforced'; block: 'enforced' | 'advisory'; completion: 'self_reported' | 'unavailable' };
  };
}

const idFor = (prefix: string, value: string): string =>
  `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;

interface Clarification {
  missing: string;
  prompt: string;
  why: string;
  recommendedAnswer: string;
}

function extractVerificationCommands(text: string): string[] {
  const patterns = [
    /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?[A-Za-z0-9:_-]+(?:\s+--\s+[A-Za-z0-9_./:-]+)?/gi,
    /\b(?:npx\s+)?(?:markdownlint|pytest|tsc)(?:\s+--?[A-Za-z0-9-]+|\s+[A-Za-z0-9_./:-]+)*/gi,
    /\bruff\s+check(?:\s+--?[A-Za-z0-9-]+|\s+[A-Za-z0-9_./:-]+)*/gi,
    /\bbash\s+(?:-n\s+)?[A-Za-z0-9_./-]+/gi
  ];
  const commands = patterns.flatMap(pattern => text.match(pattern) ?? []);
  return [...new Set(commands.map(command => command.trim()))].slice(0, 3);
}

function performanceThreshold(analysis: AnalysisResult): string | undefined {
  const match = `${analysis.text}\n${analysis.contextText}`.match(/\bp95\s*(?:below|under|低于|小于|<)\s*(\d+)\s*ms\b/i);
  return match ? `p95 < ${match[1]}ms` : undefined;
}

function benchmarkRunCount(analysis: AnalysisResult): number | undefined {
  const match = analysis.text.match(/(?:连续)?运行\s*(\d+)\s*次\s*`?(?:npm\s+run\s+)?benchmark/i);
  return match ? Number(match[1]) : undefined;
}

function clarificationFor(analysis: AnalysisResult): Clarification {
  const text = analysis.text;
  const reasons = new Set(analysis.reasons);
  const localReleasePreparation = isLocalReleasePreparation(text);

  if (/(?:私钥|密钥)/i.test(text) && /(?:仓库|git|历史|提交|泄露|重写|改写)/i.test(text)) {
    return {
      missing: '疑似泄露密钥的吊销状态与远端历史修改授权',
      prompt: '疑似泄露的私钥是否已经吊销？',
      why: '删除提交不能消除已经泄露的密钥风险，远端历史重写也具有不可逆影响。',
      recommendedAnswer: '推荐：先吊销密钥并只准备本地影响清单；未确认历史范围并获得明确推送授权前，不重写或推送远端历史。'
    };
  }
  if (/(?:关闭|关掉|禁用|绕过).*(?:MFA|二次验证|多因素认证)|(?:MFA|二次验证|多因素认证).*(?:关闭|关掉|禁用|绕过)/i.test(text)) {
    return {
      missing: '关闭生产 MFA 的准确账号身份与授权',
      prompt: '哪个已经核验身份并获授权的准确账号是本次关闭 MFA 的唯一目标？',
      why: '关闭错误账号的二次验证会直接削弱生产访问控制。',
      recommendedAnswer: '推荐：先在 auth 范围内完成只读诊断；身份、授权和恢复条件确认前不得关闭 MFA。'
    };
  }
  if (/(?:生产.+(?:region|地区).*(?:回填|批量)|(?:region|地区).*(?:回填|批量).+生产|收货地址.+(?:回填|映射))/i.test(text)) {
    return {
      missing: '生产 region 回填的唯一地址映射规则',
      prompt: '用于回填 region 的唯一可判定收货地址映射规则是什么？',
      why: '映射与异常地址策略未确定时，批量写入会产生不可判定的数据错误。',
      recommendedAnswer: '推荐：先只做 dry-run；缺失或无法识别的地址列为未匹配且不写入，备份、回滚条件和明确批准齐全后再执行。'
    };
  }
  if (/(?:公共\s*npm|内部制品库|候选包|版本号|发布渠道).*(?:发布|发出去|上传)|(?:发布|发出去|上传).*(?:公共\s*npm|内部制品库|候选包)/i.test(text)) {
    return {
      missing: '候选包的发布渠道、版本号与外部写入授权',
      prompt: '本次明确授权将候选包发布到公共 npm，还是内部制品库？',
      why: '公共与内部渠道的可见范围、版本约束和回滚影响不同，不能由项目上下文代选。',
      recommendedAnswer: '推荐：先生成本地可安装包供测试；渠道、版本号和发布授权齐全前不得上传。'
    };
  }
  if (/(?:找不到|难找到).*(?:故障排查|排障).*(?:文档)?|(?:故障排查|排障).*(?:全文)?复制到\s*README/i.test(text)) {
    return {
      missing: '故障排查内容的唯一入口与正文来源',
      prompt: '这次目标是为故障排查文档建立唯一入口，还是要求 README 自身包含全文？',
      why: '解决可发现性不一定需要复制全文，重复正文会形成多个事实来源。',
      recommendedAnswer: '推荐：在 README 增加醒目的索引链接，并保留故障排查文档作为单一正文来源。'
    };
  }
  if (/(?:坏数据|坏记录).*(?:部分结果|继续产出|立即失败|不生成文件)/i.test(text)) {
    return {
      missing: '坏记录出现时的报告数据契约',
      prompt: '遇到坏记录时应产出部分报告，还是整次失败且不生成文件？',
      why: '两种行为会形成不同的数据完整性契约。',
      recommendedAnswer: '推荐：整次失败且不留下不完整文件，避免部分结果被误当成完整报告。'
    };
  }

  if (/重复.+(?:账户|用户|记录).+(?:清|删|保留)|(?:清|删).+重复.+(?:账户|用户|记录)/i.test(text)) {
    return {
      missing: '判定重复和选择保留记录的业务规则',
      prompt: '判定重复并选择唯一保留记录时，应使用哪个业务键和优先级规则？',
      why: '没有确定性规则时，生产数据清理可能删除正确记录。',
      recommendedAnswer: '推荐：先用用户确认的唯一业务键生成只读候选清单；备份、dry-run、回滚和明确批准齐全前不删除。'
    };
  }
  if (!localReleasePreparation && /发布|发版|上线|push|tag|publish|版本.+收尾/i.test(text)) {
    return {
      missing: '发布动作范围与外部写入授权',
      prompt: '这次仅准备并验证本地发布产物，还是也明确授权 push、tag 或 publish？',
      why: '准备发布与对外发布具有不同权限和回滚影响。',
      recommendedAnswer: '推荐：先只准备本地产物并运行发布检查；未经再次确认不 push、tag 或 publish。'
    };
  }
  if (/token|认证|登录/i.test(text) && /格式|兼容|换掉|改变/i.test(text)) {
    return {
      missing: '是否允许改变公开认证兼容边界',
      prompt: '恢复登录是否必须改变公开 token 格式，还是应先在 auth 范围内保持格式兼容地修复？',
      why: '改变 token 格式会影响所有调用方和现有会话。',
      recommendedAnswer: '推荐：先保持 token 格式不变，在 auth 范围内复现并修复；只有证明确需 breaking change 时再单独确认。'
    };
  }
  if (reasons.has('risk.data_mutation') || reasons.has('risk.production_change') || reasons.has('risk.irreversible_operation')) {
    return {
      missing: '高风险操作的精确范围、恢复保障与执行授权',
      prompt: '在继续前，请确认本次允许操作的精确环境与数据范围，以及可验证的备份恢复方案和执行授权是否都已具备？',
      why: '缺少任一项都可能造成不可逆的数据或生产影响。',
      recommendedAnswer: '推荐：先限定到非生产或 dry-run，提供备份标识、恢复步骤和明确授权；未齐全前不执行。'
    };
  }
  if (/不确定.+(?:还是|或者)|减少.+请求.+(?:还是|或者).+(?:更快|等待)|debounce/i.test(text)) {
    return {
      missing: '相互竞争的产品体验目标优先级',
      prompt: '本次优先目标是减少输入触发的请求次数，还是缩短用户看到结果的等待时间？',
      why: '两个目标可能需要不同实现，项目上下文不能替用户决定优先级。',
      recommendedAnswer: '推荐：先选择用户可感知的等待时间作为目标并给出指标，再决定 debounce 是否合适。'
    };
  }
  if (/短暂提示|常驻状态|toast|页面内.+状态/i.test(text)) {
    return {
      missing: '保存反馈的交互形态',
      prompt: '保存成功后应使用短暂提示，还是页面内常驻状态？',
      why: '反馈形态会改变交互和可访问性，不能由项目文案规则代替产品选择。',
      recommendedAnswer: '推荐：沿用该页面现有反馈模式，并复用已有 i18n key。'
    };
  }
  if (/解析器|校验|旧配置|放宽|接受.+拒绝/i.test(text)) {
    return {
      missing: '需要新增兼容的最小输入与期望输出',
      prompt: '请给出一个当前被拒绝但期望接受的最小输入，以及它应产生的确切输出是什么？',
      why: '“适当放宽”没有可判定边界，可能静默改变其他输入语义。',
      recommendedAnswer: '推荐：只放宽这一种最小输入，保持 public API 和其他拒绝规则不变，并补对应回归测试。'
    };
  }
  if (/过时.+安装|安装说明.+整理|统一.+结构/i.test(text)) {
    return {
      missing: '应保留的唯一现行安装流程',
      prompt: '哪一种安装流程应作为唯一现行路径保留？',
      why: '格式规范只能约束写法，不能决定哪些安装路径仍然有效。',
      recommendedAnswer: '推荐：以项目入口文档当前链接的流程为准，先列待删除清单再修改。'
    };
  }
  if (/缓存|卡住|延迟|性能|响应时间/i.test(text) || reasons.has('intent.xy_problem')) {
    return {
      missing: '可复现的性能问题、目标指标与方案约束',
      prompt: '请先说明出现问题的具体接口或场景、当前与目标延迟，以及可接受的数据新鲜度；在确认根因前是否保持不预设缓存方案？',
      why: '直接采用缓存可能掩盖根因或引入一致性问题。',
      recommendedAnswer: '推荐：先给出可复现端点和 p95 目标，保持响应语义不变，再由诊断结果决定是否需要缓存。'
    };
  }
  if (/消息队列|数据库|云厂商|技术栈|框架|选一个|选型/i.test(text)) {
    return {
      missing: '会决定技术选型的首要运行约束',
      prompt: '吞吐与延迟、交付语义、运维能力和兼容边界中，哪一项是这次选型不可妥协的首要约束？',
      why: '缺少首要约束时，直接选型等同于替用户决定方向。',
      recommendedAnswer: '推荐：先给出峰值负载、至少一次或恰好一次语义、现有运维环境和禁止新增的依赖。'
    };
  }
  if (/测试|覆盖率|漏测/i.test(text)) {
    return {
      missing: '优先补强的模块或失败风险',
      prompt: '这次最需要降低哪一个模块或用户流程的回归风险？',
      why: '“补强测试”没有范围时无法确定测试层级和完成标准。',
      recommendedAnswer: '推荐：先指定一个高风险模块和当前缺失的失败路径，并以对应测试命令通过为验收。'
    };
  }
  if (/重构|整理|梳理|重新整理/i.test(text)) {
    return {
      missing: '重构要解决的维护问题与允许影响范围',
      prompt: '这次重构必须优先解决哪个可观察的维护问题，并且允许影响到哪些模块？',
      why: '没有维护目标和影响边界时，重构范围无法判定。',
      recommendedAnswer: '推荐：指定一个问题，例如重复逻辑或复杂度，并明确 public API 与调用方是否必须保持不变。'
    };
  }
  if (/体验|更顺滑|更高级|更专业|更好/i.test(text)) {
    return {
      missing: '需要改善的具体失败场景或可观察体验目标',
      prompt: '用户当前在哪个具体场景受阻，这次必须改善的可观察结果是什么？',
      why: '主观体验描述不足以决定实现范围和验收方式。',
      recommendedAnswer: '推荐：给出一个真实失败场景，并用耗时、完成率或明确人工检查条件定义改善结果。'
    };
  }
  if (analysis.effective.d5 === 0 || reasons.has('verification.missing')) {
    return {
      missing: '可判定的验收方式',
      prompt: '完成后应运行哪条命令或检查哪一个明确条件来判定任务成功？',
      why: '没有验收方式时无法形成可执行契约。',
      recommendedAnswer: '推荐：提供一条现有测试、类型检查或 lint 命令，并说明必须保持不变的行为。'
    };
  }
  if (analysis.effective.d2 === 0) {
    return {
      missing: '允许修改和必须保持不变的范围',
      prompt: '这次允许修改哪些文件或模块，哪些 public API、数据或行为必须保持不变？',
      why: '范围缺失会直接改变影响面。',
      recommendedAnswer: '推荐：限定一个模块，并明确禁止 breaking change、生产写入和无关重构。'
    };
  }
  return {
    missing: '具体目标与成功条件',
    prompt: '你要优先解决的具体问题是什么，完成后用哪个可观察结果判断已经解决？',
    why: '当前表达仍不足以锁定目标和完成条件。',
    recommendedAnswer: '推荐：指出一个具体对象、失败场景和一条可运行的验收命令。'
  };
}

export function buildAlignmentDecision(
  analysis: AnalysisResult,
  options: { adapter?: string; nativeHook?: boolean; verificationCommands?: string[] } = {}
): AlignmentDecision {
  const decision = decideRoute(analysis);
  const executable = decision.route === 'pass' || decision.route === 'enrich';
  const verificationCommands = options.verificationCommands ?? [];
  const explicitCommands = extractVerificationCommands(analysis.text);
  const acceptanceCommands = explicitCommands.length > 0 ? explicitCommands : verificationCommands.slice(0, 1);
  const threshold = performanceThreshold(analysis);
  const runCount = benchmarkRunCount(analysis);
  const acceptance = executable
    ? acceptanceCommands.length > 0
      ? acceptanceCommands.map((command, index) => ({
          id: `acceptance-${index + 1}`,
          criterion: threshold && /benchmark/i.test(command)
            ? `${runCount ? `连续运行 ${runCount} 次且每次 ` : ''}${threshold}：${command}`
            : `命令通过：${command}`,
          method: { kind: 'command' as const, value: command }
        }))
      : [{
          id: 'acceptance-1',
          criterion: `逐项满足请求中已声明的目标与边界：${analysis.text}`,
          method: { kind: 'manual' as const, value: `按原始请求逐项检查目标、范围、禁止项和输出条件：${analysis.text}` }
        }]
    : [];
  const clarification = decision.action === 'ask' ? clarificationFor(analysis) : undefined;
  const missing = clarification ? [clarification.missing] : [];
  const next = decision.action === 'ask'
    ? { action: 'ask', question: { id: 'clarify-1', prompt: clarification!.prompt, why: clarification!.why, recommendedAnswer: clarification!.recommendedAnswer } }
    : decision.action === 'wait_confirmation'
      ? { action: 'wait_confirmation', requirement: { id: 'confirmation-1', prompt: '请明确确认是否执行该高风险操作。', impact: ['可能修改生产环境或持久化数据'] } }
      : decision.action === 'stop'
        ? { action: 'stop', reason: '策略禁止执行该操作。' }
        : { action: 'execute' };
  const tier = decision.route === 'pass' ? 'A' : decision.route === 'enrich' ? 'B' : 'C';

  return {
    schemaVersion: '1.0.0',
    kind: 'alignment.decision',
    policyVersion: '1.0.0',
    requestId: idFor('request', analysis.text),
    decisionId: idFor('decision', JSON.stringify({ text: analysis.text, reasons: analysis.reasons })),
    route: decision.route,
    reasons: analysis.reasons,
    scores: { observed: analysis.observed, effective: analysis.effective },
    claims: [{ id: 'claim-user-request', type: 'fact', statement: analysis.text, sources: [{ kind: 'user', ref: 'request:text' }] }],
    missing,
    scope: { include: [analysis.text], exclude: [] },
    acceptance,
    ...(decision.route === 'enrich' ? { appliedContext: analysis.appliedContext } : {}),
    presentation: { mode: analysis.presentationMode, tier },
    next,
    lifecyclePlan: {
      baseline: executable ? 'required' : 'not_required',
      completion: executable ? 'required' : 'not_observable',
      precipitation: 'on_signal'
    },
    host: {
      adapter: options.adapter ?? 'pipeline',
      level: options.nativeHook ? 'L3' : 'L2',
      enforcement: {
        ingress: 'enforced',
        block: options.nativeHook ? 'enforced' : 'advisory',
        completion: executable ? 'self_reported' : 'unavailable'
      }
    }
  };
}
