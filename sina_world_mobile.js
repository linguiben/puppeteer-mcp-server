const puppeteer = require('puppeteer');
// import puppeteer, { Browser, Page } from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // 设置为移动端 UA（iPhone）
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1'
  );

  // 设置为移动设备视图
  await page.setViewport({
    width: 375,
    height: 667,
    isMobile: true,
    hasTouch: true,
  });

  // 访问新浪财经移动版页面
  await page.goto('https://gu.sina.cn/#/world', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // 等待“环球”板块内容加载
  try {
    // await page.waitForSelector('.hq-main section:nth-child(2) .hq-title', { timeout: 10000 });
    await page.waitForSelector('#app > div.hq-main > section > div:nth-child(2) > div > div', { timeout: 10000 });
    

    console.log('✅ 环球板块加载成功');

    // 抓取环球指数名称和数据
    const result = await page.evaluate(() => {
      const section = document.querySelectorAll('.hq-main section')[1];
      const items = section.querySelectorAll('.hq-list > div');
      return Array.from(items).map((el) => {
        const name = el.querySelector('.hq-name')?.innerText || 'N/A';
        const price = el.querySelector('.hq-price')?.innerText || 'N/A';
        const change = el.querySelector('.hq-change')?.innerText || 'N/A';
        return { name, price, change };
      });
    });

    // 关闭 #SFA_newVersion_close
    const closeButton = await page.$('#SFA_newVersion_close');
    if (closeButton) {
        await closeButton.click();
    } 

    console.log('📊 抓取结果:', result);

    // 截图保存
    await page.screenshot({ path: 'images/sina_world.png' });
    console.log('📸 页面截图已保存为 images/sina_world.png');
  } catch (e) {
    console.error('❌ 加载失败或结构变动:', e.message);
  }

  await browser.close();
})();

