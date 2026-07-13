# 债务台账

- [ ] G5-D01（E5 声明阻塞，非稳定版产品 Gate）：在固定模型上运行完整三臂 benchmark，并对高风险 case 至少重复 5 次；未完成时禁止声明对应 E5 能力。
- [x] G5-D02：三套一次性 held-out corpus 均在运行前冻结，运行后标记 consumed；修复后复用明确标记为 regression，不冒充 held-out。
- [x] G5-D03：独立盲评已覆盖初始 20 条和 R3 final 16 条 runtime 决定，并机械核验 route、最高价值问题、可执行验收和方向安全。
- [ ] G5-D04（E5 声明阻塞，非稳定版产品 Gate）：修复或更换 Codex CLI 凭据后补 Codex E5 evidence；当前支持矩阵继续明确标注未实测。
- [ ] G5-D05（稳定版硬债务）：强化 Windows 临时目录清理；当前偶发 cleanupError 不影响输出，但可能遗留评测临时目录。
- [x] G5-D06：产品、runtime、安装器和 release 文档已统一为 `v3.2.0-rc.1`。
- [x] G5-D07：澄清问题已按发布渠道、地址映射、账号身份、密钥吊销和 XY 目标分支；修复回归问题命中 5/5。
- [x] G5-D08：pass/enrich 决定保留用户或项目命令，performance acceptance 同时保留 benchmark 次数和 p95 阈值；修复回归 11/11 可执行。
- [x] G5-D09：R3 final 与修复回归的不必要澄清率均为 0%；旧 consumed corpus 只作 regression，未重标为 held-out。
- [ ] G5-D10（发布后持续指标，非稳定版 Gate）：通过真实使用逐步记录首轮成功率和返工轮数，不集中运行额外付费模型评测。
- [ ] G5-D11（稳定版硬债务）：对修复后的全新 blind input 做 fresh 独立盲评；本轮关闭依据是既有独立发现 + 确定性 remediation，不宣称 fresh blind pass。
