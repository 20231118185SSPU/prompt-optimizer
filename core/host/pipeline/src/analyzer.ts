import { isDocumentationTask, isCodeTask } from './task-classification';

export interface SourceRef {
  kind: 'user' | 'project' | 'runtime' | 'decision' | 'default';
  ref: string;
}

export interface DimensionScores {
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  total: number;
}

export type ScoreDimension = 'd1' | 'd2' | 'd3' | 'd4' | 'd5';
export type GapKind = 'none' | 'structural' | 'directional';

export interface ContextEvidence {
  source: SourceRef;
  gap: 'structural';
  fields: ScoreDimension[];
  statement: string;
}

export interface EffectiveScoreSource {
  dimension: ScoreDimension;
  from: number;
  to: number;
  source: SourceRef;
  evidence: string;
}

export interface AnalysisResult {
  text: string;
  contextText: string;
  presentationMode: 'default' | 'direct_output';
  reasons: string[];
  observed: DimensionScores;
  effective: DimensionScores;
  assumptionCount: number;
  gap: GapKind;
  contextEvidence: ContextEvidence[];
  effectiveScoreSources: EffectiveScoreSource[];
  appliedContext: SourceRef[];
}

const has = (text: string, pattern: RegExp): boolean => pattern.test(text);
const score = (d1: number, d2: number, d3: number, d4: number, d5: number): DimensionScores => ({
  d1, d2, d3, d4, d5, total: d1 + d2 + d3 + d4 + d5
});

const scoreDimensions: ScoreDimension[] = ['d1', 'd2', 'd3', 'd4', 'd5'];

function contextLooksRelevant(
  source: SourceRef,
  request: string,
  contextText: string,
  documentationTask: boolean,
  codeTask: boolean
): boolean {
  if (source.kind !== 'project') return false;

  const ref = source.ref.toLowerCase();
  const context = contextText.toLowerCase();
  const requestText = request.toLowerCase();
  const riskyContext = /(?:database|migration|生产|备份|回滚|mfa|密钥|publish|发布)/i.test(context);
  const sameRiskDomain = /(?:database|migration|生产|备份|回滚|mfa|密钥|publish|发布)/i.test(requestText);
  const releasePreparation = /(?:changelog|release\s+notes|发布说明)/i.test(requestText) &&
    /(?:preparing\s+local|本地|草稿|publishing|pushing)/i.test(context);
  if (riskyContext && !sameRiskDomain && !releasePreparation && contextText.length < 1200) return false;

  if (/#(?:[^#]*?(?:test|verify|parser|component|scope|boundary|验收|验证|测试))/i.test(source.ref)) {
    return true;
  }

  if (ref.includes('check-commands') || /测试与验证命令|验证命令|check-commands/.test(ref)) {
    if (documentationTask) return /markdownlint|textlint|vale|remark|rg\s+.*(?:readme|docs?)/i.test(context);
    if (codeTask) return /(?:npm\s+test|pnpm\s+test|yarn\s+test|pytest|ruff|tsc|jest|vitest|go\s+test|cargo\s+test)/i.test(context);
    return /benchmark|p95|perf/i.test(context);
  }

  if (ref.includes('fixture:')) {
    return true;
  }

  if (ref.includes('.align/lessons.md') && codeTask) {
    return /(?:typescript|strict|test|type|api|compat|component|parser|react|node|python)/i.test(context) &&
      /(?:修复|修改|实现|新增|增加|测试|代码|parser|component|接口|函数|ts|type|api)/i.test(requestText);
  }

  if (documentationTask) {
    if (ref.includes('spec') || ref.includes('fixture:')) {
      return /(?:markdown|heading|标题|文档|lint|readme|链接|release|发布|push|tag|本地)/i.test(context);
    }
    return false;
  }

  if (codeTask) {
    if (ref.includes('spec')) {
      return /(?:target|component|parser|public\s+api|backward|compatible|react|node|python|typescript|test|verify|performance|p95|dependency|范围|约束|测试|验证|ui|i18n|button|按钮|界面|文本|copy|翻译)/i.test(context);
    }
    if (ref.includes('facts') || ref.includes('glossary') || ref.includes('state') || ref.includes('context')) {
      const requestTokens = requestText.match(/[a-z][a-z0-9_-]{2,}|[\u4e00-\u9fff]{2,}/gi) ?? [];
      return requestTokens.some(token => context.includes(token.toLowerCase()));
    }
  }

  return false;
}

function evidenceStatement(source: SourceRef, fields: ScoreDimension[], contextText: string, request: string): string {
  const fieldNames = fields.map(field => ({ d1: '目标对象', d2: '范围与约束', d3: '交付结构', d4: '项目上下文', d5: '验收方式' }[field]));
  const fieldSignals: Record<ScoreDimension, RegExp> = {
    d1: /target|component|parser|函数|接口|对象|文件|readme|docs?|文档|拼写|链接/i,
    d2: /范围|约束|public\s+api|backward|compatible|不得|禁止|only|limited|do\s+not|must|keep|strict|typescript|target|component|parser|ui|i18n|button|按钮|界面|release|publishing|allowed|without|保持|markdown|heading|标题/i,
    d3: /格式|结构|markdown|heading|输出|交付|标题/i,
    d4: /项目|技术栈|react|node|python|typescript|状态|当前|target|component|parser/i,
    d5: /测试|验证|verify|benchmark|lint|pytest|npm\s+test|p95|check-commands|验收/i
  };
  const documentationRequest = /README|docs?[\\/]|文档|错别字|标题|链接|markdown/i.test(request);
  const excludedGenericLine = /项目类型|运行时依赖|构建工具|devDependency|runtime/i;
  const contextLines = contextText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line &&
      fields.some(field => fieldSignals[field].test(line)) &&
      (!documentationRequest || !excludedGenericLine.test(line) ||
        /README|markdown|heading|文档写作|标题|链接/i.test(line)));
  const prioritizedLines = documentationRequest
    ? [
        ...contextLines.filter(line => /README|markdown|heading|文档写作|标题|链接/i.test(line)),
        ...contextLines
      ]
    : contextLines;
  const excerpt = [...new Set(prioritizedLines)]
    .slice(0, 3)
    .join(' ')
    .slice(0, 240);
  return `${source.ref} 提供${fieldNames.join('、')}的结构性证据${excerpt ? `：${excerpt}` : ''}`;
}

export function isLocalReleasePreparation(text: string): boolean {
  return has(text, /(?:本地.+(?:CHANGELOG|release notes|发布说明|发布产物)|(?:CHANGELOG|release notes).+(?:本地|草稿)|(?:准备|整理).*(?:CHANGELOG|release notes|发布说明))/i) &&
    (!has(text, /(?:发布到|发出去|上传|push|tag)/i) ||
      has(text, /不要(?:创建\s*)?tag|不要\s*push|不要发布|不得发布|不发布/i));
}

export function analyzeInstruction(text: string, context: SourceRef[] = [], contextText: string = ''): AnalysisResult {
  const direct = /^\s*(?:\[直出\]|直出)/.test(text);
  const normalized = text.replace(/^\s*(?:\[直出\]|直出)\s*/, '').trim();
  const stripped = normalized
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/"[^"]*"|“[^”]*”|「[^」]*」|『[^』]*』/g, '');
  const signalText = stripped.replace(
    /(不要|不得|不准|不能|不修改|不执行|不连接|不发布|不创建|不推送|不上传|别动|别去|禁止|避免|do\s+not|don't|never|avoid)[^,，。;；.!?！？]*/gi,
    ''
  );
  const contextSignals = contextText.replace(/"[^"]*"|“[^”]*”/g, '');
  const combinedSignals = `${signalText}\n${contextSignals}`;
  const writeIntent = has(signalText, /修改|增加|新增|更新|生成|发布|发出去|上传|回填|关闭|关掉|禁用|删除|清空|重写|改写|push|deploy/i);
  const explicitReadOnlyTask = has(normalized,
    /(?:^|[：:；;，,。])\s*(?:请|只|仅|帮我)?(?:解释|说明|列出|总结|翻译|教我)|(?:只|仅)(?:解释|说明|列出|总结|翻译)|只读/i);
  const writeAfterReadOnly = explicitReadOnlyTask && has(normalized,
    /(?:然后|随后|再|并且|并同时|之后|完成后).{0,40}(?:修改|新增|发布|发出去|上传|删除|清空|重写|改写|回填|关闭|关掉|禁用|推送|push|deploy)/i);
  const noWriteTask = !writeIntent && has(normalized,
    /不修改(?:任何)?文件|不进行任何.+写操作|不要运行(?:任何)?[^,，。;；]{0,12}(?:命令|操作)|不要执行(?:任何)?[^,，。;；]{0,12}(?:命令|操作|写入|变更)|不连接或修改|不执行任何操作/i);
  const readOnly = (explicitReadOnlyTask && !writeAfterReadOnly) || noWriteTask;
  const production = has(signalText, /生产(?:环境|库|迁移|数据|订单|记录|系统|上)|正式环境|线上(?:环境)?|上线|production|deploy\s+to\s+prod/i);
  const productionBulkMutation = !readOnly && production && has(signalText, /批量(?:回填|更新|修改)|回填.+(?:字段|region)|(?:关闭|关掉|禁用).+(?:MFA|二次验证|多因素认证)|(?:MFA|二次验证|多因素认证).+(?:关闭|关掉|禁用)/i);
  const accessControlMutation = !readOnly && has(signalText, /(?:关闭|关掉|禁用|绕过|修改|更改|重置).*(?:MFA|二次验证|多因素认证|权限|权限表|访问控制)|(?:MFA|二次验证|多因素认证|权限|权限表|访问控制).*(?:关闭|关掉|禁用|绕过|修改|更改|重置)/i);
  const credentialExposure = !readOnly && has(signalText, /(?:私钥|密钥).*(?:提交|泄露|暴露|吊销|清掉|删除)|(?:提交|泄露|暴露|清掉|删除).*(?:私钥|密钥)|(?:仓库|git).+历史.+(?:私钥|密钥)/i);
  const externalEgress = !readOnly && has(signalText, /上传到外部服务器|发送到外网|发送到外部服务器|upload.*external|send.*outside/i);
  const historyRewrite = !readOnly && has(signalText, /(?:重写|改写).{0,30}(?:git|仓库|远端)?历史|(?:git|仓库|远端)?历史.{0,30}(?:重写|改写)|force\s+push/i);
  const externalPublish = !readOnly && has(signalText, /(?:公共\s*npm|内部制品库|候选包|版本号|发布渠道).*(?:发布|发出去|上传)|(?:发布|发出去|上传).*(?:公共\s*npm|内部制品库|候选包)/i);
  const mutationSignal = has(signalText, /删除|删库|清空(?:数据库|数据|表|记录|用户|文件|目录|配置)|delete|drop\s+table|truncate|批量(?:改|替换|更新|修改|删除|重置)|(?:所有用户|所有账户|所有账号|管理员|全部账号).*(?:邮箱|密码).*(?:改|重置)|替换.+(?:所有|全部|批量).+(?:用户|数据|记录|邮箱|密码|地址)/i) ||
    (production && has(signalText, /删光|清掉|抹掉/i));
  const dataMutation = (mutationSignal || productionBulkMutation) &&
    !has(normalized, /删除.+(?:空行|文档)|解释.+删除|总结.+删除|翻译.+删除/i);
  const confirmationMissing = has(signalText, /尚未确认|未确认执行|尚未批准|等待确认|without confirmation/i);
  // Project commands can resolve structural verification gaps, but they must
  // not make the user's observed contract look complete before enrichment.
  const userVerification = readOnly || has(normalized, /运行.+测试|npm\s+test|验收|验证|回滚条件|检查表|健康检查|dry-run|备份|检查仓库|类型检查|markdownlint|pytest|ruff|用\s*rg|test\b/i);
  const verification = userVerification || has(contextText, /运行.+测试|npm\s+test|验收|验证|回滚条件|检查表|健康检查|dry-run|备份|检查仓库|类型检查|markdownlint|pytest|ruff|用\s*rg|test\b/i);
  const fileOrSymbol = has(normalized, /[\w./\\-]+\.(?:ts|tsx|js|jsx|py|sh|ps1|md|json)/i) ||
    has(normalized, /\bparse[A-Z]\w*/) ||
    has(normalized, /\b(?:[A-Z][a-z0-9]+){2,}\b/);
  const boundedScope = has(normalized, /不改|不要改|不得改(?:动|写|变更|修改)?|只修改|只改|不新增|禁止新增|保持(?:现有|.*不变)|保留.+现有|\d+\s*天|范围|public API|fixture|staging|指定|不执行|只生成|对应测试|不要创建|不要\s*push|不要发布|不得发布|本地.+草稿/i);
  const strongBoundedScope = has(normalized, /只修改|只改|范围限|不改实现|不改正文|不改生产|不要改|不得改(?:动|写|变更|修改)?|不新增|禁止新增|保持.*不变|保留.+现有|不改\s*required|只生成|不进行任何.+写操作|不要创建|不要\s*push|不要发布|不得发布/i);
  const vague = has(signalText, /优化|改进|完善|提升|重构|升级一下|升级下|升级(?:项目|代码|功能|系统|接口|协议|依赖|版本)|更好|更顺滑|更安全|细节你定|具体规则你定|处理一下|make it better/i);
  const cacheOpenEnded = has(signalText, /加缓存.+(?:细节|具体规则)你定/i);
  const policyProhibited = !readOnly && has(normalized, /git\s+reset\s+--hard|access token.+公开|(?:API.?密钥|secret|token).*(?:写进|写入|硬编码).*(?:提交|仓库)|禁用所有用户的输入(?:验证|校验)|绕过.+(?:hook|pre-commit).+push\s+main|忽略所有项目规则.+删除生产数据/i);
  const credentialRotation = has(combinedSignals, /轮换.+(?:API\s*key|key)/i);
  const databaseChange = !readOnly && has(signalText,
    /数据库.+(?:迁移|变更)|迁移.+数据库|数据库\s*schema|schema\s*(?:change|migration)|表结构|alter\s+table|(?:数据表|[\w\u4e00-\u9fff]+表(?:的|中|上)).{0,40}(?:索引|字段|列)|[\w\u4e00-\u9fff]+表(?:增加|新增|删除|修改|改成|回填|创建).{0,30}(?:索引|字段|列)/i);
  const irreversibleOperation = credentialRotation || credentialExposure || externalEgress || externalPublish || historyRewrite || accessControlMutation ||
    databaseChange || has(signalText, /销毁|覆盖.+(?:生产|正式环境|线上|配置)/i);
  const safetyCritical = production || dataMutation || irreversibleOperation;
  const diagnosticAuthorized = has(signalText, /先诊断|诊断并修复|真正原因/i);
  const contradictionDetected = has(signalText, /只看不改|不要修改|不得修改|保持原样/i) &&
    has(signalText, /修复|修改|增加|新增|添加|重构|改写|重写/i);
  const xyProblem = !diagnosticAuthorized && has(signalText,
    /加\s*\d+\s*秒\s*sleep|TTL.+解决.+CPU|catch.+返回\s*200|删除失败的测试|结果上限.+改成\s*10|为了解决.*把.*(?:异步|并发).*(?:同步|串行)|为了.*把.*(?:异常|错误).*(?:吞掉|忽略|屏蔽)|用正则.*解析.*HTML|正则.*HTML.*提取|用\s*eval|动态执行.*用户/i);
  const localImpactReviewRequired = has(normalized, /调用方都别看|不要看调用方|禁止检查调用方/i);
  const alternativesAcceptedByUser = has(normalized,
    /都(?:可以|能接受|行)|两者(?:皆可|都可|均可)|任一(?:种|个|方案)?(?:都)?(?:可以|可|能接受)|任选/i);
  const choiceDelegatedToAgent = has(normalized,
    /你(?:来|替我)?(?:选|挑|定)|帮我(?:选|挑|定)|交给你(?:选|定)|由你决定/i);
  const explicitlyDelegatedChoice = alternativesAcceptedByUser && choiceDelegatedToAgent;
  const localReleasePreparation = isLocalReleasePreparation(normalized);
  const performanceBudgetContext = has(contextText, /(?:performance\s+target|性能目标|p95)/i) &&
    has(contextText, /(?:benchmark|p95|性能|响应时间|延迟|耗时)/i);
  const boundedPerformanceChange = has(signalText, /减少.+(?:重复)?(?:数据库)?读取|减少.+(?:查询|请求)|降低.+(?:延迟|耗时)|(?:优化|提升).+(?:性能|响应时间|延迟|耗时)/i) &&
    (fileOrSymbol || strongBoundedScope || performanceBudgetContext);
  const explicitLayoutGoal = has(normalized, /(?:真正|实际|核心)目标.+(?:按钮|界面).+(?:单行|不换行)/i);
  const explicitAction = fileOrSymbol || readOnly || has(signalText,
    /修改|增加|新增|重命名|修复|修掉|调整|手改|准备|生成|更新|改为|改成|补(?:充|一节|上|\s*description|(?:一条|对应)?(?:界面|单元|回归)?测试)|清空按钮|清空(?:当前)?输入|正在保存状态/i);
  const authorized = has(signalText, /已授权|已批准/i);
  const offlineOnly = has(normalized, /不连接数据库|不执行数据库变更|不执行|只生成/i);
  const directionChoiceAmbiguous = !explicitlyDelegatedChoice && (choiceDelegatedToAgent || has(normalized,
    /不确定.+(?:还是|或者)|(?:还没想好|尚未决定|拿不准).+(?:还是|或者)|(?:还是|或者).+(?:你看着办|你决定)|你看着办|你决定|由你决定|细节你定|细节你处理/i));
  const completeRiskContract = (production || dataMutation || irreversibleOperation) && boundedScope && verification &&
    (authorized || offlineOnly || confirmationMissing || has(signalText, /备份|回滚|dry-run/i));
  const documentationTask = isDocumentationTask(normalized);
  const codeTaskSignal = !documentationTask && (fileOrSymbol || explicitAction ||
    has(normalized, /(?:修复|修改|新增|增加|实现|解析器|parser|component|组件|函数|接口|测试|代码|bug|API|tsx?|jsx?|py|性能|响应|界面|按钮|交互|翻译|搜索)/i));
  const codeTask = codeTaskSignal || isCodeTask(normalized);
  const noConcreteGoal = !fileOrSymbol && !explicitAction && !readOnly && !explicitlyDelegatedChoice &&
    !localReleasePreparation && !boundedPerformanceChange && !explicitLayoutGoal;
  const directionalGap = (vague && !boundedPerformanceChange) || directionChoiceAmbiguous || noConcreteGoal || contradictionDetected;
  const relevantSources = context.filter(source =>
    contextLooksRelevant(source, normalized, contextText, documentationTask, codeTask)
  );
  const structuralGap = relevantSources.length > 0 && !directionalGap;
  const contextCanResolve = structuralGap &&
    (explicitAction || diagnosticAuthorized || explicitlyDelegatedChoice || localReleasePreparation || boundedPerformanceChange || explicitLayoutGoal) &&
    !xyProblem && !directionChoiceAmbiguous && (!safetyCritical || completeRiskContract);

  let observed: DimensionScores;
  if (policyProhibited) {
    observed = score(2, 2, 2, 1, 1);
  } else if (completeRiskContract) {
    observed = score(2, 2, 2, 1, 1);
  } else if (readOnly && explicitAction) {
    observed = score(2, 2, 2, 1, 1);
  } else if (explicitAction && strongBoundedScope && userVerification) {
    observed = score(2, 2, 2, 1, 1);
  } else if (fileOrSymbol && boundedScope) {
    observed = userVerification ? score(2, 2, 2, 1, 1) : score(2, 2, 2, 1, 0);
  } else if (cacheOpenEnded) {
    observed = score(0, 0, 1, 1, 0);
  } else if (vague || dataMutation) {
    observed = score(0, 0, 0, 1, 0);
  } else if (boundedScope && verification) {
    observed = userVerification
      ? score(2, 1, has(normalized, /完成后/) ? 2 : 1, 1, 1)
      : score(2, 1, has(normalized, /完成后/) ? 2 : 1, 1, 0);
  } else {
    observed = score(1, boundedScope ? 1 : 0, 1, 1, userVerification ? 1 : 0);
  }

  const contextFields = new Map<ScoreDimension, ContextEvidence[]>();
  for (const source of relevantSources) {
    const fields: ScoreDimension[] = [];
    if (codeTask || documentationTask) fields.push('d1');
    if (documentationTask) {
      if (/markdown|heading|标题|文档|不得|禁止|do\s+not|链接|release|publishing|local|本地|tag/i.test(contextText)) fields.push('d2', 'd3');
      if (/markdownlint|textlint|vale|lint|验证|验收/i.test(contextText) ||
          ((source.ref.includes('.align/spec.md') || source.ref.includes('fixture:')) && documentationTask)) fields.push('d5');
    } else {
      if (/范围|约束|public\s+api|backward|compatible|不得|禁止|prohibited|only|limited|do\s+not|must|keep|strict|typescript|target|component|parser|ui|i18n|button|按钮|界面|release|publishing|allowed|without|保持/i.test(contextText) ||
          /target|component|parser/.test(source.ref)) fields.push('d2');
      if (/格式|结构|markdown|heading|输出|交付|performance|p95|benchmark|响应语义/i.test(contextText)) fields.push('d3');
      if (/项目|技术栈|react|node|python|typescript|状态|当前|target|component|parser|ui|i18n|button|按钮|界面|文本|copy|翻译/i.test(contextText)) fields.push('d4');
      if (/测试|验证|verify|benchmark|lint|pytest|npm\s+test|p95|check-commands|验收/i.test(contextText) ||
          source.ref.includes('check-commands') ||
          ((source.ref.includes('.align/spec.md') || source.ref.includes('fixture:')) && codeTask)) {
        // Only let context fill d5 acceptance when the user has some verification
        // signal, a concrete target, or bounded scope. Bare requests like "更新文档"
        // should not get acceptance from context alone.
        if (userVerification || fileOrSymbol || boundedScope || boundedPerformanceChange ||
            explicitLayoutGoal || (explicitAction && normalized.length > 10)) {
          fields.push('d5');
        }
      }
    }
    const uniqueFields = [...new Set(fields)];
    if (uniqueFields.length > 0) {
      const evidence: ContextEvidence = {
        source,
        gap: 'structural',
        fields: uniqueFields,
        statement: evidenceStatement(source, uniqueFields, contextText, normalized)
      };
      for (const field of uniqueFields) {
        const current = contextFields.get(field) ?? [];
        current.push(evidence);
        contextFields.set(field, current);
      }
    }
  }

  const effective = { ...observed };
  const effectiveScoreSources: EffectiveScoreSource[] = [];
  const applyContextScore = (dimension: ScoreDimension, target: number, evidence: ContextEvidence): void => {
    const current = effective[dimension];
    if (target <= current) return;
    effective[dimension] = target;
    effective.total = effective.d1 + effective.d2 + effective.d3 + effective.d4 + effective.d5;
    effectiveScoreSources.push({
      dimension,
      from: current,
      to: target,
      source: evidence.source,
      evidence: evidence.statement
    });
  };

  if (contextCanResolve) {
    for (const dimension of scoreDimensions) {
      const evidence = contextFields.get(dimension)?.[0];
      if (!evidence) continue;
      if (dimension === 'd1') applyContextScore(dimension, 2, evidence);
      if (dimension === 'd2') applyContextScore(dimension, 1, evidence);
      if (dimension === 'd3') applyContextScore(dimension, 1, evidence);
      if (dimension === 'd4') applyContextScore(dimension, 1, evidence);
      if (dimension === 'd5') applyContextScore(dimension, 1, evidence);
    }
  }

  const projectResolvesVerification = effective.d5 > observed.d5;
  const projectResolvesContract = effective.total > observed.total;
  const adoptedEvidenceSources = contextCanResolve
    ? [...contextFields.values()].flat().map(evidence => evidence.source)
    : [];
  const appliedContext = [...new Map(adoptedEvidenceSources
    .map(source => [source.kind + ':' + source.ref, source] as const)).values()];
  const assumptionCount = cacheOpenEnded ? 3 : 0;
  const reasons: string[] = [];

  if (policyProhibited) reasons.push('policy.operation_prohibited');
  if (confirmationMissing) reasons.push('authorization.confirmation_missing');
  if (production) reasons.push('risk.production_change');
  if (dataMutation) reasons.push('risk.data_mutation');
  if (irreversibleOperation) reasons.push('risk.irreversible_operation');
  if (completeRiskContract && !confirmationMissing && !policyProhibited) reasons.push('requirements.needs_enrichment');
  if (xyProblem) reasons.push('intent.xy_problem');
  if (contradictionDetected) reasons.push('intent.ambiguous_goal');
  if (localImpactReviewRequired) reasons.push('requirements.needs_enrichment');
  if ((directionChoiceAmbiguous || !normalized || vague || dataMutation) && !completeRiskContract && !contextCanResolve && !policyProhibited) {
    reasons.push('intent.ambiguous_goal');
  }
  if (dataMutation && !completeRiskContract && !policyProhibited) reasons.push('scope.impact_unknown');
  if (assumptionCount > 2) reasons.push('assumption.too_many');
  if (observed.d5 === 0) reasons.push('verification.missing');
  if (effective.total < 6) reasons.push('diagnosis.score_below_threshold');
  if (projectResolvesVerification || projectResolvesContract) reasons.push('context.resolvable_from_project');
  if (effective.total >= 6 && effective.total <= 7 && reasons.length === 0) {
    reasons.push('requirements.needs_enrichment');
  }
  if (effective.total >= 8 && reasons.length === 0) reasons.push('requirements.sufficient');
  if (direct) reasons.push('override.explicit_direct_output');

  return {
    text: normalized,
    contextText,
    presentationMode: direct ? 'direct_output' : 'default',
    reasons,
    observed,
    effective,
    assumptionCount,
    gap: directionalGap ? 'directional' : structuralGap ? 'structural' : 'none',
    contextEvidence: [...new Map([...contextFields.values()].flat().map(item => [item.source.kind + ':' + item.source.ref, item])).values()],
    effectiveScoreSources,
    appliedContext
  };
}
