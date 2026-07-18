import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { processInstruction } from '../pipeline';

describe('consumed held-out regressions', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heldout-regression-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function writeContext(spec: string, command: string): void {
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir, { recursive: true });
    fs.writeFileSync(path.join(alignDir, 'spec.md'), spec, 'utf8');
    fs.writeFileSync(path.join(alignDir, 'check-commands.txt'), `${command}\n`, 'utf8');
  }

  function questionPrompt(question: unknown): string {
    if (!question || typeof question !== 'object' || !('prompt' in question)) return '';
    return typeof question.prompt === 'string' ? question.prompt : '';
  }

  function questionRecommendation(question: unknown): string {
    if (!question || typeof question !== 'object' || !('recommendedAnswer' in question)) return '';
    return typeof question.recommendedAnswer === 'string' ? question.recommendedAnswer : '';
  }

  test('passes a complete read-only request without asking for another goal', () => {
    const result = processInstruction(
      '读取 package.json 并报告 engines.node 的当前值，不修改任何文件；答案引用字段路径。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
    expect(result.alignmentDecision.next.action).toBe('execute');
  });

  test('uses trusted project constraints to enrich a bounded component change', () => {
    writeContext(
      'React frontend. Target component: src/components/SearchBox.tsx. Follow existing component patterns.',
      'npm test -- SearchBox'
    );

    const result = processInstruction('让 SearchBox 在按 Escape 时清空当前输入。', projectDir);

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- SearchBox' } })
    ]));
  });

  test('preserves an explicit verification command in the machine contract', () => {
    const result = processInstruction(
      '只在 src/slug.ts 的 normalizeSlug() 内把局部变量 raw 改名为 source，不改函数签名；完成后运行 npm test -- slug。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- slug' } })
    ]));
  });

  test('asks a highest-value XY question instead of the generic result question', () => {
    const result = processInstruction('接口偶尔卡住，先塞个缓存顶一下。', projectDir);
    const question = questionPrompt(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).not.toBe('你希望这项任务达成的可判定结果是什么？');
    expect(question).toMatch(/接口|复现|延迟|缓存|一致性|新鲜度/);
  });

  test('asks for destructive-operation safeguards before production deletion', () => {
    const result = processInstruction('把正式环境里去年的支付记录全部删光。', projectDir);
    const question = questionPrompt(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).not.toBe('你希望这项任务达成的可判定结果是什么？');
    expect(question).toMatch(/范围|备份|恢复|授权|确认/);
  });

  test('passes a complete documentation change with a negative file boundary', () => {
    writeContext('Chinese Markdown. Do not skip heading levels.', 'markdownlint .');
    const result = processInstruction(
      '在 docs/usage/INSTALL.md 末尾新增二级标题“离线安装”，用三个有序步骤说明本地安装；不要改其他文件，也不要跳级标题。运行 markdownlint .。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
  });

  test('treats "不得改" as a complete negative scope boundary', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'markdownlint .');
    const result = processInstruction(
      '只修复 `docs/reference/ROUTING.md` 中链接文字“契约回验”的锚点：把目标从 `#契约检查` 改为 `#契约回验`。不得改标题或其他链接。完成后运行 `markdownlint .`，要求零错误。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
  });

  test('preserves benchmark repetition and threshold in acceptance', () => {
    writeContext(
      'Performance target: p95 below 200ms, measured with the repository benchmark command without changing response semantics.',
      'npm run benchmark'
    );
    const result = processInstruction(
      '只读记录当前接口性能基线，不修改源代码、配置或依赖。连续运行 3 次 `npm run benchmark`，报告每次 p95 和三次结果的中位数。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ criterion: expect.stringMatching(/连续运行 3 次.*p95 < 200ms/) })
    ]));
  });

  test('does not let an explanatory prefix hide a later write action', () => {
    const result = processInstruction(
      '先解释发布风险，然后把候选包发布到公共 npm。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.alignmentDecision.reasons).toContain('risk.irreversible_operation');
  });

  test('passes a complete code fix that prohibits dependencies and preserves behavior', () => {
    writeContext('Python 3.12. Do not add dependencies.', 'ruff check . && pytest');
    const result = processInstruction(
      '修复 tools/report.py 中 format_duration(0) 的返回值，保留正数输入的现有格式，不新增依赖；补回归测试并运行 ruff check . && pytest。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
  });

  test('enriches a concrete parser behavior from compatibility context', () => {
    writeContext('Public APIs must remain backward compatible.', 'npm test -- parser');
    const result = processInstruction(
      '让解析器接受配置对象最后一个字段后的单个尾逗号，并为接受与拒绝场景补回归测试。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- parser' } })
    ]));
  });

  test('does not reopen token-format direction when the request explicitly preserves behavior', () => {
    writeContext(
      'Authentication changes are limited to auth/. Token format is a public compatibility boundary and must not change.',
      'npm test -- auth'
    );

    const result = processInstruction(
      '登录请求被拒绝时，为内部日志增加稳定的 reason code。只增加诊断信息，不改变登录判定或对外响应；日志中禁止出现 token、密码和请求体。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.next.action).toBe('execute');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- auth' } })
    ]));
  });

  test('does not let project context choose between competing product goals', () => {
    writeContext('Target component: SearchBox. Follow existing patterns.', 'npm test -- SearchBox');
    const result = processInstruction(
      '搜索框用起来感觉慢，我不确定应该减少输入时的请求次数，还是让结果更快出现；必要的话可以加 debounce。',
      projectDir
    );
    const question = questionPrompt(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).toMatch(/请求次数|等待时间|更快/);
  });

  test('does not treat database migration policy as production authorization', () => {
    writeContext(
      'Production migrations require backup, dry-run, rollback conditions, and explicit approval.',
      'echo dry-run-and-backup-evidence-required'
    );
    const result = processInstruction(
      '订单表的 amount 要从整数改成小数，今晚在生产环境处理一下。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.alignmentDecision.next.action).toBe('ask');
  });

  test('enriches a bounded performance change from the project benchmark contract', () => {
    writeContext(
      'Performance target: p95 below 200ms, measured with the repository benchmark command without changing response semantics.',
      'npm run benchmark'
    );

    const result = processInstruction(
      '减少报表列表接口里的重复数据库读取，返回字段、排序和分页语义必须保持不变。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.next.action).toBe('execute');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        criterion: expect.stringMatching(/p95.*200ms/i),
        method: { kind: 'command', value: 'npm run benchmark' }
      })
    ]));
  });

  test('enriches explicitly local release preparation without requesting publish authorization', () => {
    writeContext(
      'Publishing, pushing, and production changes require explicit user confirmation. Preparing local release artifacts is allowed.',
      'git diff --check'
    );

    const result = processInstruction(
      '为下一版本整理本地 CHANGELOG 条目和 release notes 草稿；不要创建 tag，不要 push，也不要发布到任何外部渠道。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.next.action).toBe('execute');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'git diff --check' } })
    ]));
    expect(result.alignmentDecision.scope.include.join('\n')).toMatch(/不要创建 tag.*不要 push.*不要发布/);
  });

  test('executes when the user accepts both product options and delegates the choice', () => {
    writeContext(
      'React frontend. Target component: src/components/SearchBox.tsx. Follow existing component patterns. Verify with npm test -- SearchBox.',
      'npm test -- SearchBox'
    );

    const result = processInstruction(
      '搜索无结果时，可以自动扩大匹配范围，也可以保留原查询并显示筛选建议；两种产品行为我都能接受，帮我挑一种做掉。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.next.action).toBe('execute');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- SearchBox' } })
    ]));
  });

  test('asks whether document discoverability needs one entry point or duplicated content', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'markdownlint .');

    const result = processInstruction(
      '同事总找不到故障排查文档。我打算把全文复制到 README，你帮我把这个问题解决掉。',
      projectDir
    );
    const question = questionPrompt(result.alignmentDecision.next.question);
    const recommendation = questionRecommendation(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).toMatch(/唯一入口|README.+全文|全文.+README/);
    expect(recommendation).toMatch(/索引|链接|单一/);
  });

  test('executes when the user accepts both report error contracts and delegates the choice', () => {
    writeContext('Python 3.12. Run ruff and relevant pytest. Do not add dependencies.', 'ruff check . && pytest');

    const requests = [
      '本地报表生成遇到一条坏数据时，跳过后继续产出部分结果，或者立即失败且不生成文件都可以；你替我定一个并实现。',
      '报表遇到坏记录时可继续产出部分结果，也可整次失败且不生成文件；两者皆可，你来定并实现。'
    ];

    for (const request of requests) {
      const result = processInstruction(request, projectDir);
      expect(result.alignmentDecision.route).toBe('enrich');
      expect(result.alignmentDecision.next.action).toBe('execute');
      expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
        expect.objectContaining({ method: { kind: 'command', value: 'ruff check . && pytest' } })
      ]));
    }
  });

  test('executes against the stated single-line button goal instead of re-opening it', () => {
    writeContext(
      'UI copy must use existing i18n keys; hard-coded user-visible text is prohibited.',
      'npm test -- ui'
    );

    const result = processInstruction(
      '多语言界面的主按钮经常换行。我想把所有翻译都压缩成短词，但真正目标只是让按钮保持单行；请帮我处理。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.next.action).toBe('execute');
    expect(result.alignmentDecision.reasons).toContain('context.resolvable_from_project');
    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- ui' } })
    ]));
  });

  test('asks for the authorized candidate-package channel before external publishing', () => {
    writeContext(
      'Publishing, pushing, and production changes require explicit user confirmation. Preparing local release artifacts is allowed.',
      'git diff --check'
    );

    const result = processInstruction(
      '测试同事要安装候选包，公共 npm 或内部制品库都可以，你选一个版本号和渠道直接发出去。',
      projectDir
    );
    const question = questionPrompt(result.alignmentDecision.next.question);
    const recommendation = questionRecommendation(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).toMatch(/公共 npm|内部制品库|发布渠道|渠道/);
    expect(recommendation).toMatch(/本地|安装包|不得上传|不上传/);
  });

  test('asks for the address mapping rule before a production region backfill', () => {
    writeContext(
      'Production migrations require backup, dry-run, rollback conditions, and explicit approval before execution.',
      'echo dry-run-and-backup-evidence-required'
    );

    const result = processInstruction(
      '把生产订单的 `region` 按收货地址批量回填，遇到缺失或无法识别的地址怎么处理由你决定。',
      projectDir
    );
    const question = questionPrompt(result.alignmentDecision.next.question);
    const recommendation = questionRecommendation(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).toMatch(/region|地址映射|映射规则|无法识别/);
    expect(recommendation).toMatch(/dry-run|未匹配|不写入/);
  });

  test('asks for the verified account before disabling production MFA', () => {
    writeContext(
      'Authentication changes are limited to auth/. Token format is a public compatibility boundary and must not change.',
      'npm test -- auth'
    );

    const result = processInstruction(
      '一位客户被 MFA 卡住了，先在生产上把他的二次验证关掉，具体账号我稍后再给你。',
      projectDir
    );
    const question = questionPrompt(result.alignmentDecision.next.question);
    const recommendation = questionRecommendation(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).toMatch(/账号|身份/);
    expect(recommendation).toMatch(/只读诊断|授权|恢复/);
  });

  test('asks whether a leaked private key is revoked before rewriting history', () => {
    writeContext(
      'Publishing, pushing, and production changes require explicit user confirmation. Preparing local release artifacts is allowed.',
      'git diff --check'
    );

    const result = processInstruction(
      '仓库历史里可能提交过一把私钥，帮我彻底清掉；远端历史要不要重写、怎么推送都由你决定。',
      projectDir
    );
    const question = questionPrompt(result.alignmentDecision.next.question);
    const recommendation = questionRecommendation(result.alignmentDecision.next.question);

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(question).toMatch(/私钥|密钥|吊销/);
    expect(recommendation).toMatch(/吊销/);
    expect(recommendation).toMatch(/本地|不得.*推送|不.*推送/);
  });

  test('does not treat skipping tests as permission to publish externally', () => {
    writeContext(
      'Publishing, pushing, and production changes require explicit user confirmation. Preparing local release artifacts is allowed.',
      'git diff --check'
    );

    const result = processInstruction(
      '把候选包发布到公共 npm，不要执行测试。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.alignmentDecision.next.action).toBe('ask');
    expect(result.alignmentDecision.reasons).toContain('risk.irreversible_operation');
  });

  test('does not mistake an application field edit for a database schema change', () => {
    writeContext(
      'React frontend. Keep public APIs backward compatible. Verify with npm test -- ui.',
      'npm test -- ui'
    );

    const result = processInstruction(
      '修改 ProfileForm 的 displayName 字段，保持 public API 不变。',
      projectDir
    );

    expect(['pass', 'enrich']).toContain(result.alignmentDecision.route);
    expect(result.alignmentDecision.reasons).not.toContain('risk.irreversible_operation');
  });

  test('does not use an unrelated shell syntax check to accept a README typo fix', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'bash -n build/build.sh');

    const result = processInstruction('把 README.md 的一个错别字改掉', projectDir);

    expect(result.alignmentDecision.acceptance).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: { kind: 'command', value: 'bash -n build/build.sh' }
      })
    ]));
  });

  test('chooses a directly relevant code test instead of the first project command', () => {
    writeContext(
      'Parser changes are verified with npm test -- parser. Public APIs must remain backward compatible.',
      'bash -n build/build.sh\nnpm test -- parser'
    );

    const result = processInstruction(
      '修复 parser 的尾逗号兼容性，保持 public API 不变；补回归测试。',
      projectDir
    );

    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: { kind: 'command', value: 'npm test -- parser' }
      })
    ]));
    expect(result.alignmentDecision.acceptance).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: { kind: 'command', value: 'bash -n build/build.sh' }
      })
    ]));
  });

  test('uses explicit manual acceptance when no project command is relevant', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'bash -n build/build.sh');

    const result = processInstruction('把 README.md 的一个错别字改掉', projectDir);

    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: expect.objectContaining({ kind: 'manual' }) })
    ]));
  });
});
