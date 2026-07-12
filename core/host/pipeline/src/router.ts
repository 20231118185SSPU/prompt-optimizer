import { Classification } from './classifier';

export type Verdict = 'HIGH' | 'VAGUE' | 'GRAY' | 'CLEAR';

export interface RoutingResult {
  verdict: Verdict;
  instructions: string;
}

const HIGH_INSTRUCTIONS = `[对齐] ⚠️ 高风险指令（判定：HIGH）。按以下对齐协议执行，禁止跳步：
1. 先读 .align/lessons.md → spec.md → facts/glossary/state（三文件未齐时同时读 context.md）
2. 列出全部影响面：哪些文件/数据/环境/调用方会被改动
3. 输出执行方案，须包含：改动清单 / 回滚条件 / 验证方式 / 风险说明
4. 停下等待用户明确确认后再执行——禁止在确认前做任何写操作
5. 确认后执行，完成后跑验证命令并报告结果
硬性红线：高风险静默执行 = 无效输出，必须重做。`;

const VAGUE_INSTRUCTIONS = `[对齐] 指令目标或对象不够明确（判定：VAGUE）。按以下对齐协议执行：
1. 先读 .align/lessons.md → spec.md → facts/glossary/state（三文件未齐时同时读 context.md）
2. 能从项目文件/代码/文档读到的信息，自行读取，不问用户
3. 仍缺失且会改变目标/范围/验收的关键信息 → 一次只问一个问题，附推荐答案
4. 意图对齐后，按 Agent Brief 八组件执行：目标/背景/范围/交付物/约束/执行策略/验收/沉淀
5. 禁止在意图对齐前输出最终方案——猜错返工比一次澄清成本更高`;

const GRAY_INSTRUCTIONS = `[对齐] 指令存在歧义（判定：GRAY）。按以下对齐协议执行：
1. 先读 .align/lessons.md → spec.md → facts/glossary/state（三文件未齐时同时读 context.md）
2. 判断指令是教学语境（解释/介绍）还是执行语境
3. 如果是教学语境，按常规回答
4. 如果是执行语境，按 VAGUE 协议执行
5. 无法判断时，按 VAGUE 协议执行（保守处理）`;

const CLEAR_INSTRUCTIONS = `[对齐] 指令清楚（判定：CLEAR），按以下执行协议行动：
1. 先读 .align/lessons.md → spec.md → facts/glossary/state（三文件未齐时同时读 context.md）
2. 按 Agent Brief 执行：明确目标 → 锁定范围 → 最小变更 → 完成后验证
3. 完成后自行验证核心功能未回归
4. 有踩坑/纠正/新约定 → 追加到 .align/lessons.md（一条≤2行）
5. 交付前自验证（R8 验证门不可跳过）`;

export function route(classification: Classification): RoutingResult {
  const { risk, vague, specific, edu } = classification;

  let verdict: Verdict;
  let instructions: string;

  if (risk >= 1) {
    if (edu >= 1) {
      verdict = 'GRAY';
      instructions = GRAY_INSTRUCTIONS;
    } else {
      verdict = 'HIGH';
      instructions = HIGH_INSTRUCTIONS;
    }
  } else if (vague >= 1 && specific === 0) {
    verdict = 'VAGUE';
    instructions = VAGUE_INSTRUCTIONS;
  } else if (vague >= 1 && specific >= 1) {
    verdict = 'GRAY';
    instructions = GRAY_INSTRUCTIONS;
  } else {
    verdict = 'CLEAR';
    instructions = CLEAR_INSTRUCTIONS;
  }

  return { verdict, instructions };
}
