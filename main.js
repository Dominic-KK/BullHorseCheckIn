// ==UserScript==
// @name         🤖 牛马福音：智能打卡救命脚本-本地开发
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

(function () {
  "use strict";

  // 从设置中读取配置
  const ON_WORK_TIME = GM_getValue("基础设置.OnWork") || "9:00";
  const OFF_WORK_TIME = GM_getValue("基础设置.OffWork") || "18:00";
  const HITOKOTO_ENABLED = GM_getValue("基础设置.Hitokoto", true);
  const WEBHOOK_KEY = GM_getValue("企业微信消息推送（原群机器人）.QYWX_Key");
  const AT_SOMEONE =
    GM_getValue("企业微信消息推送（原群机器人）.AtSomeone") || "all";

  // 消息模板设置
  const ON_WORK_TITLE =
    GM_getValue("消息模板设置.OnWorkTitle") || "🌅 上班打卡提醒 ⏰";
  const ON_WORK_CONTENT =
    GM_getValue("消息模板设置.OnWorkContent") ||
    "⏰ 时间：{timeStr}\n💼 今天是周{weekday}，上班时间到啦！记得打卡哦～\n🎯 今日目标：高效工作，快乐生活！";
  const OFF_WORK_TITLE =
    GM_getValue("消息模板设置.OffWorkTitle") || "🌇 下班打卡提醒 ⏰";
  const OFF_WORK_CONTENT =
    GM_getValue("消息模板设置.OffWorkContent") ||
    "⏰ 时间：{timeStr}\n🚪 今天是周{weekday}，下班时间到啦！别忘记打卡～\n📋 今日总结：完成工作，享受生活！";

  // 状态存储key
  const LAST_REMIND_DATE_KEY = "last_remind_date";

  GM_log("打卡提醒脚本开始执行，当前配置：");
  GM_log(
    `上班时间: ${ON_WORK_TIME}, 下班时间: ${OFF_WORK_TIME}, @设置: ${AT_SOMEONE}, 一言功能: ${
      HITOKOTO_ENABLED ? "开启" : "关闭"
    }`
  );

  class WeChatWorkBot {
    constructor(webhookKey) {
      this.webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
    }

    // 发送文本消息（支持@功能）
    async sendTextMessage(
      content,
      mentioned_list = [],
      mentioned_mobile_list = []
    ) {
      const messageData = {
        msgtype: "text",
        text: {
          content: content,
          mentioned_list: mentioned_list,
          mentioned_mobile_list: mentioned_mobile_list,
        },
      };

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: this.webhookUrl,
          headers: {
            "Content-Type": "application/json",
          },
          data: JSON.stringify(messageData),
          onload: function (response) {
            try {
              const result = JSON.parse(response.responseText);
              if (result.errcode === 0) {
                GM_log("消息发送成功");
                GM_notification({
                  title: "消息发送成功",
                  text: "打卡提醒消息发送成功",
                  timeout: 5000,
                });
                resolve(result);
              } else {
                GM_log("消息发送失败: " + result.errmsg);
                reject(new Error(result.errmsg));
              }
            } catch (error) {
              GM_log("解析响应失败: " + error.message);
              reject(error);
            }
          },
          onerror: function (error) {
            GM_log("请求失败: " + error);
            reject(error);
          },
        });
      });
    }
  }

  // 获取一言内容
  async function getHitokoto() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: "https://v1.hitokoto.cn/",
        timeout: 5000,
        onload: function (response) {
          try {
            if (response.status === 200) {
              const data = JSON.parse(response.responseText);
              let hitokotoText = data.hitokoto;

              // 添加出处信息
              if (data.from || data.from_who) {
                let source = "";
                if (data.from_who) source += data.from_who;
                if (data.from) {
                  if (source) source += "《";
                  source += data.from;
                  if (data.from_who) source += "》";
                }
                if (source) hitokotoText += ` —— ${source}`;
              }

              GM_log("一言获取成功: " + hitokotoText);
              resolve(hitokotoText);
            } else {
              GM_log("一言API请求失败，状态码: " + response.status);
              resolve(null);
            }
          } catch (error) {
            GM_log("解析一言响应失败: " + error.message);
            resolve(null);
          }
        },
        onerror: function (error) {
          GM_log("一言请求失败: " + error);
          resolve(null);
        },
        ontimeout: function () {
          GM_log("一言请求超时");
          resolve(null);
        },
      });
    });
  }

  // 时间处理函数
  function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return { hours, minutes };
  }

  // 检查是否应该发送提醒
  function shouldSendRemind(remindType) {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // 获取目标时间
    const targetTime = remindType === "onWork" ? ON_WORK_TIME : OFF_WORK_TIME;
    const { hours: targetHours, minutes: targetMinutes } =
      parseTime(targetTime);

    // 检查是否在目标时间的分钟范围内（允许±3分钟的误差）
    if (
      currentHours === targetHours &&
      Math.abs(currentMinutes - targetMinutes) <= 3
    ) {
      // 检查今天是否已经发送过该类型的提醒
      const today = now.toDateString();
      const lastRemindDate = GM_getValue(
        `${LAST_REMIND_DATE_KEY}_${remindType}`
      );

      if (lastRemindDate !== today) {
        GM_setValue(`${LAST_REMIND_DATE_KEY}_${remindType}`, today);
        return true;
      } else {
        const remindTypeStr = remindType === "onWork" ? "上班" : "下班";
        GM_log("今天已经发送过" + remindTypeStr + "打卡提醒了哦");
      }
    }

    return false;
  }

  // 构建@参数
  function buildMentionParams() {
    if (!AT_SOMEONE || AT_SOMEONE === "all") {
      return { mentioned_list: ["@all"], mentioned_mobile_list: [] };
    }

    if (AT_SOMEONE.trim() === "" || AT_SOMEONE === "0") {
      return { mentioned_list: [], mentioned_mobile_list: [] };
    }

    // 处理手机号列表
    const mobileList = AT_SOMEONE.split(",")
      .map((mobile) => mobile.trim())
      .filter((mobile) => mobile.length > 0);

    return { mentioned_list: [], mentioned_mobile_list: mobileList };
  }

  // 模板变量替换函数
  function replaceTemplateVariables(template, variables) {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  // 构建消息内容
  async function buildMessage(remindType) {
    const now = new Date();
    const timeStr = now.toLocaleString("zh-CN");
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];

    // 定义模板变量
    const variables = {
      timeStr: timeStr,
      weekday: weekday,
    };

    let titleTemplate, contentTemplate;

    if (remindType === "onWork") {
      titleTemplate = ON_WORK_TITLE;
      contentTemplate = ON_WORK_CONTENT;
    } else {
      titleTemplate = OFF_WORK_TITLE;
      contentTemplate = OFF_WORK_CONTENT;
    }

    // 替换模板变量
    const title = replaceTemplateVariables(titleTemplate, variables);
    const content = replaceTemplateVariables(contentTemplate, variables);

    let baseMessage = title + "\n\n" + content;

    // 如果开启了一言功能，获取一言并添加到消息中
    if (HITOKOTO_ENABLED) {
      try {
        const hitokoto = await getHitokoto();
        if (hitokoto) {
          baseMessage += `\n\n💫 ${hitokoto}\n\n`;
        }
      } catch (error) {
        GM_log("获取一言失败，但继续发送主要消息: " + error.message);
      }
    }

    return baseMessage;
  }

  // 主执行函数
  async function main() {
    try {
      GM_log("开始检查打卡提醒任务");

      if (!WEBHOOK_KEY) {
        throw new Error("请先在脚本设置中配置企业微信机器人的Webhook Key");
      }

      const bot = new WeChatWorkBot(WEBHOOK_KEY);

      // 检查上班提醒
      if (shouldSendRemind("onWork")) {
        GM_log("发送上班打卡提醒");
        const message = await buildMessage("onWork");
        const mentionParams = buildMentionParams();
        await bot.sendTextMessage(
          message,
          mentionParams.mentioned_list,
          mentionParams.mentioned_mobile_list
        );
      }

      // 检查下班提醒
      if (shouldSendRemind("offWork")) {
        GM_log("发送下班打卡提醒");
        const message = await buildMessage("offWork");
        const mentionParams = buildMentionParams();
        await bot.sendTextMessage(
          message,
          mentionParams.mentioned_list,
          mentionParams.mentioned_mobile_list
        );
      }

      GM_log("打卡提醒检查完成");
    } catch (error) {
      GM_log("脚本执行出错: " + error.message);
      GM_notification({
        title: "打卡提醒脚本错误",
        text: error.message,
        timeout: 5000,
      });
    }
  }

  // 执行主函数
  main();
})();
