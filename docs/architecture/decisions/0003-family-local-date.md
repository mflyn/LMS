# ADR-0003: 业务日期使用家庭 LocalDate

**Status:** Accepted
**Date:** 2026-06-18

## Context

任务截止日、成长记录日和周报周界是家庭日历概念。将其直接保存为服务器时区或 UTC Date 会在跨午夜和跨时区时改变所属日期。

## Decision

家庭保存有效 IANA timezone，默认 `Asia/Shanghai`。业务日期保存为 `YYYY-MM-DD` LocalDate String；事件时间保存为 UTC Date/ISO 8601。today 按家庭时区计算，week 为包含两端的周一至周日。

## Alternatives

- 全部保存 UTC Date：适合瞬时时间，不适合无时刻的家庭日历日期。
- 使用服务器本地时区：部署位置变化会改变结果。

## Consequences

日期查询可使用字符串范围且语义稳定。现有 BSON Date 家庭任务需要按家庭时区迁移；所有边界测试必须固定当前时间。

## Validation

测试上海时区跨午夜、周日到周一、包含周日，以及 UTC 时间戳序列化。
