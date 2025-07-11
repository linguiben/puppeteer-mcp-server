/// <reference types="puppeteer" />
const puppeteer = require('puppeteer');

// 从命令行参数中获取URL
const args = process.argv.slice(2);
const url = args[0];
const x = args[1] ? parseInt(args[1], 10) : 0; // 默认值为 0
const y = args[2] ? parseInt(args[2], 10) : 0; // 默认值为 0
// 如果有提供 x 和 y，则使用它们，否则使用默认值
// 这里的 x 和 y 是截图区域的左上角坐标
// 如果没有提供，则默认为 0
// 如果有提供 width 和 height，则使用它们，否则使用默认值
// 这里的 width 和 height 是截图区域的宽度和高度
// 如果没有提供，则默认为 800 和 600
// 注意：如果提供了 x 和 y，则 width 和 height 必须大于 0
const width = args[3] ? parseInt(args[3], 10) : 800; // 默认值为 800
const height = args[4] ? parseInt(args[4], 10) : 600; // 默认值为 600

// 获取中国时区（东八区）时间戳字符串
function getCnTimeISOString() {
  const date = new Date();
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000); // 转为 UTC 时间
  const cnTime = new Date(utcTime + (3600000 * 8)); // 加上 8 小时得到北京时间
  return cnTime.toISOString().replace(/[^0-9]/g, '');
}

if (!url) {
  console.error('❌ 请提供一个URL作为参数！');
  console.log('示例: node capture_url.js https://www.example.com');
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true, // 改成 true 就不显示窗口
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      // '--proxy-server=http://127.0.0.1:8086'
    ],
  });

  const page = await browser.newPage();

  // 设置类似真实浏览器的 UA
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );
  // 设置视口大小
  await page.setViewport({
    width: 1280,
    height: 800
  });

  // 处理URL，用于文件名
  const urlForFilename = url
    .replace(/^https?:\/\//, '') // 去除 "http://" 或 "https://"
    .replace(/\//g, '_');        // 将 "/" 替换为 "_"
  // 构建截图路径
  const timestamp = getCnTimeISOString();
  const screenshotPath = `images/${timestamp}_${urlForFilename}.png`;

  // 访问网站
  try {
    // await page.goto(url, { waitUntil: 'networkidle2' });
    await page.goto(url);
  } catch (err) {
    console.error('页面加载失败:', err.message);
  }

  await page.screenshot({
    path: screenshotPath,
    clip: { x: x, y: y, width: width, height: height } // 使用命令行参数指定截图区域
  });
  console.log(`${screenshotPath}`);
  await browser.close();
  // process.exit(1);
})();

