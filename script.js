// ==UserScript==
// @name         打卡提醒
// @namespace    https://www.dominickk.top/
// @version      0.1.0
// @description  妈妈再也不用担心我被扣绩效了！支持自定义消息模板和一言功能
// @author       🌹Dominic·KK🌹
// @crontab      * * * * *
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_log
// @connect      qyapi.weixin.qq.com
// @connect      v1.hitokoto.cn
// ==/UserScript==

/* ==UserConfig==
基础设置:
    OnWork:
      title: 上班时间（在±3分钟时提醒）
      description: 默认24小时制 9:00
      default: 9:00
    OffWork:
      title: 下班时间（在±3分钟时提醒）
      description: 默认24小时制 18:00
      default: 18:00
    Hitokoto:
      title: 每日一言
      description: 开启后会在消息中添加每日一言
      type: switch
      default: false
---
消息模板设置:
    OnWorkTitle:
      title: 上班提醒标题
      description: 仅文本格式，不支持markdown。支持变量 {timeStr}, {weekday}
      default:
    OnWorkContent:
      title: 上班提醒内容
      description: 换行用\n。支持变量 {timeStr}, {weekday}
      default:
    OffWorkTitle:
      title: 下班提醒标题
      description: 仅文本格式，不支持markdown。支持变量 {timeStr}, {weekday}
      default:
    OffWorkContent:
      title: 下班提醒内容
      description: 换行用\n。支持变量 {timeStr}, {weekday}
      default:
---
企业微信消息推送（原群机器人）:           
    QYWX_Key:
      title: 企业微信Webhook_key
      description: 请输入webhook中"key="之后的内容
      password: true
    AtSomeone:
      title: 机器人在群里 @某人，不填则默认 @全员，填0则不进行@
      description: 输入格式:以逗号分隔手机号 例如 138xxxxxxxx,137xxxxxxxx
      default: all
 ==/UserConfig== */

!(function () {
  "use strict";
  const t = GM_getValue("基础设置.OnWork") || "9:00",
    e = GM_getValue("基础设置.OffWork") || "18:00",
    o = GM_getValue("基础设置.Hitokoto", !0),
    n = GM_getValue("企业微信消息推送（原群机器人）.QYWX_Key"),
    i = GM_getValue("企业微信消息推送（原群机器人）.AtSomeone") || "all",
    r = GM_getValue("消息模板设置.OnWorkTitle") || "🌅 上班打卡提醒 ⏰",
    s =
      GM_getValue("消息模板设置.OnWorkContent") ||
      "⏰ 时间：{timeStr}\n💼 今天是周{weekday}，上班时间到啦！记得打卡哦～\n🎯 今日目标：高效工作，快乐生活！",
    l = GM_getValue("消息模板设置.OffWorkTitle") || "🌇 下班打卡提醒 ⏰",
    a =
      GM_getValue("消息模板设置.OffWorkContent") ||
      "⏰ 时间：{timeStr}\n🚪 今天是周{weekday}，下班时间到啦！别忘记打卡～\n📋 今日总结：完成工作，享受生活！",
    _ = "last_remind_date";
  GM_log("打卡提醒脚本开始执行，当前配置："),
    GM_log(
      `上班时间: ${t}, 下班时间: ${e}, @设置: ${i}, 一言功能: ${
        o ? "开启" : "关闭"
      }`
    );
  class u {
    constructor(t) {
      this.webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${t}`;
    }
    async sendTextMessage(t, e = [], o = []) {
      const n = {
        msgtype: "text",
        text: { content: t, mentioned_list: e, mentioned_mobile_list: o },
      };
      return new Promise((t, e) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: this.webhookUrl,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(n),
          onload: function (o) {
            try {
              const n = JSON.parse(o.responseText);
              0 === n.errcode
                ? (GM_log("消息发送成功"),
                  GM_notification({
                    title: "消息发送成功",
                    text: "打卡提醒消息发送成功",
                    timeout: 5e3,
                  }),
                  t(n))
                : (GM_log("消息发送失败: " + n.errmsg), e(new Error(n.errmsg)));
            } catch (t) {
              GM_log("解析响应失败: " + t.message), e(t);
            }
          },
          onerror: function (t) {
            GM_log("请求失败: " + t), e(t);
          },
        });
      });
    }
  }
  function m(o) {
    const n = new Date(),
      i = n.getHours(),
      r = n.getMinutes(),
      s = "onWork" === o ? t : e,
      { hours: l, minutes: a } = (function (t) {
        const [e, o] = t.split(":").map(Number);
        return { hours: e, minutes: o };
      })(s);
    if (i === l && Math.abs(r - a) <= 3) {
      const t = n.toDateString();
      if (GM_getValue(`${_}_${o}`) !== t)
        return GM_setValue(`${_}_${o}`, t), !0;
      GM_log(
        "今天已经发送过" + ("onWork" === o ? "上班" : "下班") + "打卡提醒了哦"
      );
    }
    return !1;
  }
  function c() {
    if (!i || "all" === i)
      return { mentioned_list: ["@all"], mentioned_mobile_list: [] };
    if ("" === i.trim() || "0" === i)
      return { mentioned_list: [], mentioned_mobile_list: [] };
    return {
      mentioned_list: [],
      mentioned_mobile_list: i
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };
  }
  function g(t, e) {
    return t.replace(/{(\w+)}/g, (t, o) => (void 0 !== e[o] ? e[o] : t));
  }
  async function f(t) {
    const e = new Date(),
      n = {
        timeStr: e.toLocaleString("zh-CN"),
        weekday: ["日", "一", "二", "三", "四", "五", "六"][e.getDay()],
      };
    let i, _;
    "onWork" === t ? ((i = r), (_ = s)) : ((i = l), (_ = a));
    let u = g(i, n) + "\n\n" + g(_, n);
    if (o)
      try {
        const t = await (async function () {
          return new Promise((t, e) => {
            GM_xmlhttpRequest({
              method: "GET",
              url: "https://v1.hitokoto.cn/",
              timeout: 5e3,
              onload: function (e) {
                try {
                  if (200 === e.status) {
                    const o = JSON.parse(e.responseText);
                    let n = o.hitokoto;
                    if (o.from || o.from_who) {
                      let t = "";
                      o.from_who && (t += o.from_who),
                        o.from &&
                          (t && (t += "《"),
                          (t += o.from),
                          o.from_who && (t += "》")),
                        t && (n += ` —— ${t}`);
                    }
                    GM_log("一言获取成功: " + n), t(n);
                  } else
                    GM_log("一言API请求失败，状态码: " + e.status), t(null);
                } catch (e) {
                  GM_log("解析一言响应失败: " + e.message), t(null);
                }
              },
              onerror: function (e) {
                GM_log("一言请求失败: " + e), t(null);
              },
              ontimeout: function () {
                GM_log("一言请求超时"), t(null);
              },
            });
          });
        })();
        t && (u += `\n\n💫 ${t}\n\n`);
      } catch (t) {
        GM_log("获取一言失败，但继续发送主要消息: " + t.message);
      }
    return u;
  }
  !(async function () {
    try {
      if ((GM_log("开始检查打卡提醒任务"), !n))
        throw new Error("请先在脚本设置中配置企业微信机器人的Webhook Key");
      const t = new u(n);
      if (m("onWork")) {
        GM_log("发送上班打卡提醒");
        const e = await f("onWork"),
          o = c();
        await t.sendTextMessage(e, o.mentioned_list, o.mentioned_mobile_list);
      }
      if (m("offWork")) {
        GM_log("发送下班打卡提醒");
        const e = await f("offWork"),
          o = c();
        await t.sendTextMessage(e, o.mentioned_list, o.mentioned_mobile_list);
      }
      GM_log("打卡提醒检查完成");
    } catch (t) {
      GM_log("脚本执行出错: " + t.message),
        GM_notification({
          title: "打卡提醒脚本错误",
          text: t.message,
          timeout: 5e3,
        });
    }
  })();
})();
