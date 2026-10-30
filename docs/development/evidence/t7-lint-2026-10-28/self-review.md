# T7 lint 修订开发自查

日期：2026-10-28。结果：SELF_REVIEW_PASSED / INDEPENDENT_REVIEW_PENDING。
本记录不关闭 QA-T7-LINT-COVERAGE-001 或 T7 总门禁，不替代独立评审线程复验。

## 审查范围

1. ESLint 增量只有根 release-gate-artifacts/** 和两份明确周报路径，没有规则降级。
2. 归档路径排除、正式源码与嵌套同名路径继续检查；实际 ESLint API 的 no-undef 为 error，
   合法 JSX/Node/Jest 零错误零警告。不以 config 字符串存在代替执行验证。
3. 测试先红后绿；缺失规则初版 TypeError 单独保留，后续有效红灯为四个 expect 失败。
   五种独立进程内存变异全部产生目标断言失败；磁盘源码哈希未变。
4. 正式规则揭示的三处源码问题未被忽略：两处测试格式修改 AST 等价，唯一服务变更删除
   generateOrRead 中未使用的局部 weekEnd。buildSnapshot 的 weekEnd 和 cutoff 逻辑不变。
5. 周报模型 33、正式 HTTP 35 和最终质量/文档 280 通过，原 npm run lint 通过。
   本机 Node 26.9.0 结果不冒称独立 Node 22、Ubuntu、浏览器或真机结果。
6. 旧 T7 冻结补丁、394 原始证据、七项关闭记录/47 附加证据及独立清单 119 文件加 manifest
   逐项只读比对；新增索引绑定增量，不覆盖旧哈希，不把后续变化倒写成旧关闭候选。

## 失败与边界

根 lint 原 44 错误、配置后 3 错误、初版断言及正式红灯均保留，不能将历史写为全绿。
完整 release 未再执行，03--18、07b/13b 发布阶段、Docker、Git clean 仍无本批通过证据。
没有启动新的发布框架、清理工作区、提交、推送、合并、部署或访问真实数据。

T4/T7 OPEN，DEVICE_PENDING/MANUAL_PENDING，Docker INCOMPLETE_FAILED，
T5-NB-001/002 OPEN_NONBLOCKING、REMAINDER_DEFERRED 和 T8/T9 未启动保持不变。

## 独立复评重点

按 validation.json 核对当前六文件增量及完整候选；独立执行原 lint、现有质量门禁和受影响
周报/HTTP 回归。复核路径边界、两周报有效规则、变异是否确实触发 ESLint、合法全局变量以及
最小源码修改。独立复评前仅称开发修复完成，不写问题 CLOSED，也不推进完整发布或总门禁。
