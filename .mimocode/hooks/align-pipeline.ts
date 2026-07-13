import type { Hooks } from "@mimo-ai/plugin"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const hooks: Hooks = {
  "experimental.chat.messages.transform": async (input, output) => {
    // Find the last user message
    const lastUserMsg = output.messages.findLast((m: any) => m.role === "user")
    if (!lastUserMsg) return

    const userText = typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content.map((c: any) => c.text || "").join("")

    // Check for bypass
    if (userText.startsWith("[直出]") || userText.startsWith("直出")) {
      return
    }

    // Try to read .align/ context
    const projectDir = process.cwd()
    const alignDir = join(projectDir, ".align")

    if (!existsSync(alignDir)) {
      return
    }

    // Read .align/ files
    const readFile = (path: string): string => {
      try {
        if (existsSync(path)) {
          return readFileSync(path, "utf-8").trim()
        }
      } catch {}
      return ""
    }

    const lessons = readFile(join(alignDir, "lessons.md"))
    const spec = readFile(join(alignDir, "spec.md"))
    const context = readFile(join(alignDir, "context.md"))

    if (lessons || spec || context) {
      const contextParts: string[] = []

      if (lessons) {
        // Extract last 30 lessons
        const lessonLines = lessons.split("\n").filter(l => l.trim().startsWith("- "))
        const limited = lessonLines.slice(-30).join("\n")
        contextParts.push(`── 项目经验规则（必须遵守）──\n${limited}`)
      }
      if (spec) {
        contextParts.push(`── 项目规范 ──\n${spec}`)
      }
      if (context) {
        contextParts.push(`── 项目上下文 ──\n${context}`)
      }

      if (contextParts.length > 0) {
        const enrichedMessage = `${contextParts.join("\n\n")}\n\n── 用户指令 ──\n${userText}`
        lastUserMsg.content = enrichedMessage
      }
    }
  },

  "experimental.chat.system.transform": async (input, output) => {
    // Add alignment protocol instructions to system prompt
    const projectDir = process.cwd()
    const alignDir = join(projectDir, ".align")

    if (!existsSync(alignDir)) {
      return
    }

    output.system.push(`
## 对齐运行时（自动注入）

本项目使用对齐管线，每条指令必须经过三档路由评估：

1. **HIGH（高风险）**：含不可逆操作（删除/生产/数据库/不可逆）→ 必停下确认
2. **VAGUE（模糊）**：目标或对象不明 → 一次只问一个问题，附推荐答案
3. **CLEAR（清楚）**：目标明确 → 直接执行，完成后验证

执行前必须读取：
- .align/lessons.md（项目经验规则）
- .align/spec.md（项目规范）
- .align/context.md（项目上下文）

硬性红线：高风险静默执行 = 无效输出，必须重做。
`)
  },
}

export default hooks
