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

export interface AnalysisResult {
  text: string;
  contextText: string;
  presentationMode: 'default' | 'direct_output';
  reasons: string[];
  observed: DimensionScores;
  effective: DimensionScores;
  assumptionCount: number;
  appliedContext: SourceRef[];
}

const has = (text: string, pattern: RegExp): boolean => pattern.test(text);
const score = (d1: number, d2: number, d3: number, d4: number, d5: number): DimensionScores => ({
  d1, d2, d3, d4, d5, total: d1 + d2 + d3 + d4 + d5
});

export function isLocalReleasePreparation(text: string): boolean {
  return has(text, /本地.+(?:CHANGELOG|release notes|发布说明|发布产物)|(?:CHANGELOG|release notes).+(?:本地|草稿)/i) &&
    has(text, /不要(?:创建\s*)?tag|不要\s*push|不要发布|不得发布|不发布/i);
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
  const verificationSignals = `${normalized}\n${contextText}`;
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
  const accessControlMutation = !readOnly && has(signalText, /(?:关闭|关掉|禁用|绕过).*(?:MFA|二次验证|多因素认证)|(?:MFA|二次验证|多因素认证).*(?:关闭|关掉|禁用|绕过)/i);
  const credentialExposure = !readOnly && has(signalText, /(?:私钥|密钥).*(?:提交|泄露|暴露|吊销|清掉|删除)|(?:提交|泄露|暴露|清掉|删除).*(?:私钥|密钥)|(?:仓库|git).+历史.+(?:私钥|密钥)/i);
  const historyRewrite = !readOnly && has(signalText, /(?:重写|改写).{0,30}(?:git|仓库|远端)?历史|(?:git|仓库|远端)?历史.{0,30}(?:重写|改写)|force\s+push/i);
  const externalPublish = !readOnly && has(signalText, /(?:公共\s*npm|内部制品库|候选包|版本号|发布渠道).*(?:发布|发出去|上传)|(?:发布|发出去|上传).*(?:公共\s*npm|内部制品库|候选包)/i);
  const mutationSignal = has(signalText, /删除|删库|清空(?:数据库|数据|表|记录|用户|文件|目录|配置)|delete|drop\s+table|truncate/i) ||
    (production && has(signalText, /删光|清掉|抹掉/i));
  const dataMutation = (mutationSignal || productionBulkMutation) &&
    !has(normalized, /删除.+(?:空行|文档)|解释.+删除|总结.+删除|翻译.+删除/i);
  const confirmationMissing = has(signalText, /尚未确认|未确认执行|尚未批准|等待确认|without confirmation/i);
  const verification = readOnly || has(verificationSignals, /运行.+测试|npm\s+test|验收|验证|回滚条件|检查表|健康检查|dry-run|备份|检查仓库|类型检查|markdownlint|pytest|ruff|用\s*rg|test\b/i);
  const fileOrSymbol = has(normalized, /[\w./\\-]+\.(?:ts|tsx|js|jsx|py|sh|ps1|md|json)/i) ||
    has(normalized, /\bparse[A-Z]\w*/) ||
    has(normalized, /\b(?:[A-Z][a-z0-9]+){2,}\b/);
  const boundedScope = has(normalized, /不改|不要改|不得改(?:动|写|变更|修改)?|只修改|只改|不新增|禁止新增|保持(?:现有|.+不变)|保留.+现有|\d+\s*天|范围|public API|fixture|staging|指定|不执行|只生成|对应测试|不要创建|不要\s*push|不要发布|不得发布|本地.+草稿/i);
  const strongBoundedScope = has(normalized, /只修改|只改|范围限|不改实现|不改正文|不改生产|不要改|不得改(?:动|写|变更|修改)?|不新增|禁止新增|保持.+不变|保留.+现有|不改\s*required|只生成|不进行任何.+写操作|不要创建|不要\s*push|不要发布|不得发布/i);
  const vague = has(signalText, /优化|改进|完善|细节你定|处理一下|make it better/i);
  const cacheOpenEnded = has(signalText, /加缓存.+细节你定/i);
  const policyProhibited = !readOnly && has(normalized, /git\s+reset\s+--hard|access token.+公开|绕过.+(?:hook|pre-commit).+push\s+main|忽略所有项目规则.+删除生产数据/i);
  const credentialRotation = has(combinedSignals, /轮换.+(?:API\s*key|key)/i);
  const databaseChange = !readOnly && has(signalText,
    /数据库.+(?:迁移|变更)|迁移.+数据库|数据库\s*schema|schema\s*(?:change|migration)|表结构|alter\s+table|(?:数据表|[\w\u4e00-\u9fff]+表(?:的|中|上)).{0,40}(?:索引|字段|列)|[\w\u4e00-\u9fff]+表(?:增加|新增|删除|修改|改成|回填|创建).{0,30}(?:索引|字段|列)/i);
  const irreversibleOperation = credentialRotation || credentialExposure || historyRewrite || externalPublish || accessControlMutation ||
    databaseChange || has(signalText, /销毁|覆盖.+(?:生产|正式环境|线上|配置)/i);
  const safetyCritical = production || dataMutation || irreversibleOperation;
  const diagnosticAuthorized = has(signalText, /先诊断|诊断并修复|真正原因/i);
  const xyProblem = !diagnosticAuthorized && has(signalText,
    /加\s*\d+\s*秒\s*sleep|TTL.+解决.+CPU|catch.+返回\s*200|删除失败的测试|结果上限.+改成\s*10/i);
  const localImpactReviewRequired = has(normalized, /调用方都别看|不要看调用方|禁止检查调用方/i);
  const alternativesAcceptedByUser = has(normalized,
    /都(?:可以|能接受|行)|两者(?:皆可|都可|均可)|任一(?:种|个|方案)?(?:都)?(?:可以|可|能接受)|任选/i);
  const choiceDelegatedToAgent = has(normalized,
    /你(?:来|替我)?(?:选|挑|定)|帮我(?:选|挑|定)|交给你(?:选|定)|由你决定/i);
  const explicitlyDelegatedChoice = alternativesAcceptedByUser && choiceDelegatedToAgent;
  const localReleasePreparation = isLocalReleasePreparation(normalized);
  const boundedPerformanceChange = has(signalText, /减少.+(?:重复)?(?:数据库)?读取|减少.+(?:查询|请求)|降低.+(?:延迟|耗时)/i);
  const explicitLayoutGoal = has(normalized, /(?:真正|实际|核心)目标.+(?:按钮|界面).+(?:单行|不换行)/i);
  const explicitAction = fileOrSymbol || readOnly || has(signalText,
    /修改|增加|新增|重命名|修复|修掉|调整|手改|准备|生成|更新|改为|改成|补(?:充|一节|上|\s*description|(?:一条|对应)?(?:界面|单元|回归)?测试)|清空按钮|清空(?:当前)?输入|正在保存状态/i);
  const authorized = has(signalText, /已授权|已批准/i);
  const offlineOnly = has(normalized, /不连接数据库|不执行数据库变更|不执行|只生成/i);
  const directionChoiceAmbiguous = !explicitlyDelegatedChoice && (choiceDelegatedToAgent || has(normalized,
    /不确定.+(?:还是|或者)|(?:还没想好|尚未决定|拿不准).+(?:还是|或者)|(?:还是|或者).+(?:你看着办|你决定)|你看着办|你决定|由你决定|细节你定|细节你处理/i));
  const completeRiskContract = (production || dataMutation || irreversibleOperation) && boundedScope && verification &&
    (authorized || offlineOnly || confirmationMissing || has(signalText, /备份|回滚|dry-run/i));
  const hasProjectContext = context.some(item => item.kind === 'project');
  const contextCanResolve = hasProjectContext &&
    (explicitAction || diagnosticAuthorized || explicitlyDelegatedChoice || localReleasePreparation || boundedPerformanceChange || explicitLayoutGoal || (vague && normalized.length > 8)) &&
    !xyProblem && !directionChoiceAmbiguous && (!safetyCritical || completeRiskContract);

  let observed: DimensionScores;
  if (policyProhibited) {
    observed = score(2, 2, 2, 1, 1);
  } else if (completeRiskContract) {
    observed = score(2, 2, 2, 1, 1);
  } else if (readOnly && explicitAction) {
    observed = score(2, 2, 2, 1, 1);
  } else if (explicitAction && strongBoundedScope && verification) {
    observed = score(2, 2, 2, 1, 1);
  } else if (fileOrSymbol && boundedScope) {
    observed = verification ? score(2, 2, 2, 1, 1) : score(2, 2, 2, 1, 0);
  } else if (cacheOpenEnded) {
    observed = score(0, 0, 1, 1, 0);
  } else if (vague || dataMutation) {
    observed = score(0, 0, 0, 1, 0);
  } else if (boundedScope && verification) {
    observed = score(2, 1, has(normalized, /完成后/) ? 2 : 1, 1, 1);
  } else {
    observed = score(1, boundedScope ? 1 : 0, 1, 1, verification ? 1 : 0);
  }

  const appliedContext = context.slice();
  const projectResolvesVerification = observed.total >= 6 && observed.d5 === 0 && hasProjectContext;
  const projectResolvesContract = contextCanResolve && observed.total < 6;
  const effective = projectResolvesContract
    ? score(2, 1, 1, 1, 1)
    : projectResolvesVerification
      ? score(observed.d1, observed.d2, observed.d3, observed.d4, 1)
      : { ...observed };
  const assumptionCount = cacheOpenEnded ? 3 : 0;
  const reasons: string[] = [];

  if (policyProhibited) reasons.push('policy.operation_prohibited');
  if (confirmationMissing) reasons.push('authorization.confirmation_missing');
  if (production) reasons.push('risk.production_change');
  if (dataMutation) reasons.push('risk.data_mutation');
  if (irreversibleOperation) reasons.push('risk.irreversible_operation');
  if (xyProblem) reasons.push('intent.xy_problem');
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
    appliedContext
  };
}
