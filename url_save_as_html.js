/// <reference types="puppeteer" />
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const url = args[0];

const ALLOWED_RESOURCE_TYPES = new Set(['stylesheet', 'image', 'script', 'media']);
const SKIPPED_SCHEMES = ['data:', 'blob:', 'javascript:', 'mailto:', 'tel:'];

function getCnTimeISOString() {
  const now = new Date();
  const cnt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return cnt.toISOString().replace(/[^0-9]/g, '').substring(0, 14);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortHash(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10);
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

function sanitizeSegment(segment) {
  return decodeSafe(segment)
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.{1,2}$/, '_');
}

function sanitizeHost(host) {
  return host.replace(/[:]/g, '_');
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function slugifyUrlForDir(inputUrl) {
  return inputUrl
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');
}

function getContentType(headers) {
  const value = headers['content-type'] || headers['Content-Type'] || '';
  return value.split(';')[0].trim().toLowerCase();
}

function getExtensionFromContentType(contentType) {
  const mapping = {
    'text/css': '.css',
    'text/html': '.html',
    'application/xhtml+xml': '.html',
    'application/javascript': '.js',
    'text/javascript': '.js',
    'application/x-javascript': '.js',
    'application/json': '.json',
    'application/ld+json': '.json',
    'application/xml': '.xml',
    'text/xml': '.xml',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'text/plain': '.txt',
  };
  return mapping[contentType] || '';
}

function isTextLike(contentType) {
  return (
    contentType.startsWith('text/') ||
    contentType === 'application/javascript' ||
    contentType === 'text/javascript' ||
    contentType === 'application/x-javascript' ||
    contentType === 'application/json' ||
    contentType === 'application/ld+json' ||
    contentType === 'application/xml' ||
    contentType === 'text/xml' ||
    contentType === 'image/svg+xml'
  );
}

function buildRelativeAssetPath(resourceUrl, contentType) {
  const parsed = new URL(resourceUrl);
  const host = sanitizeHost(parsed.host || 'unknown-host');
  const rawSegments = parsed.pathname.split('/').filter(Boolean);
  const sanitizedSegments = rawSegments.map(sanitizeSegment).filter(Boolean);

  let fileName = sanitizedSegments.pop() || 'index';

  if (parsed.pathname.endsWith('/') && rawSegments.length > 0) {
    sanitizedSegments.push(fileName || 'index');
    fileName = 'index';
  }

  let extension = path.posix.extname(fileName);
  let baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  if (!baseName) {
    baseName = 'index';
  }

  if (!extension) {
    extension = getExtensionFromContentType(contentType);
  }

  if (parsed.search) {
    baseName = `${baseName}__q_${shortHash(parsed.search)}`;
  }

  const finalFileName = `${baseName}${extension}`;
  return path.posix.join('assets', host, ...sanitizedSegments, finalFileName);
}

function makeUniqueRelativePath(relativePath, resourceUrl, usedPaths) {
  if (!usedPaths.has(relativePath)) {
    usedPaths.set(relativePath, resourceUrl);
    return relativePath;
  }

  if (usedPaths.get(relativePath) === resourceUrl) {
    return relativePath;
  }

  const extension = path.posix.extname(relativePath);
  const withoutExtension = extension
    ? relativePath.slice(0, -extension.length)
    : relativePath;
  let candidate = `${withoutExtension}__${shortHash(resourceUrl)}${extension}`;

  while (usedPaths.has(candidate) && usedPaths.get(candidate) !== resourceUrl) {
    candidate = `${withoutExtension}__${shortHash(resourceUrl + candidate)}${extension}`;
  }

  usedPaths.set(candidate, resourceUrl);
  return candidate;
}

function shouldSkipReference(value) {
  if (!value) {
    return true;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return true;
  }

  return SKIPPED_SCHEMES.some((scheme) => trimmed.toLowerCase().startsWith(scheme));
}

function normalizeLookupUrl(resourceUrl) {
  if (!isHttpUrl(resourceUrl)) {
    return resourceUrl;
  }

  try {
    const parsed = new URL(resourceUrl);
    parsed.hash = '';
    return parsed.toString();
  } catch (_error) {
    return resourceUrl;
  }
}

function rewriteCssText(cssText, cssSourceUrl, fromRelativePath, resolveLocalPath) {
  const rewriteValue = (rawValue, preserveHash = true) => {
    if (shouldSkipReference(rawValue)) {
      return rawValue;
    }

    try {
      const absoluteUrl = new URL(rawValue, cssSourceUrl);
      const resolvedPath = resolveLocalPath(absoluteUrl.href, fromRelativePath);
      if (!resolvedPath) {
        return rawValue;
      }

      return preserveHash ? `${resolvedPath}${absoluteUrl.hash || ''}` : resolvedPath;
    } catch (_error) {
      return rawValue;
    }
  };

  let rewrittenCss = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_match, quote, rawValue) => {
    const nextValue = rewriteValue(rawValue);
    return `url(${quote || ''}${nextValue}${quote || ''})`;
  });

  rewrittenCss = rewrittenCss.replace(
    /@import\s+(?!url\()(['"])([^'"]+)\1/gi,
    (_match, quote, rawValue) => {
      const nextValue = rewriteValue(rawValue, false);
      return `@import ${quote}${nextValue}${quote}`;
    }
  );

  return rewrittenCss;
}

function rewriteSrcsetText(srcsetValue, baseUrl, fromRelativePath, resolveLocalPath) {
  return srcsetValue
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return trimmed;
      }

      const firstWhitespaceIndex = trimmed.search(/\s/);
      const rawUrl =
        firstWhitespaceIndex === -1 ? trimmed : trimmed.slice(0, firstWhitespaceIndex);
      const descriptor =
        firstWhitespaceIndex === -1 ? '' : trimmed.slice(firstWhitespaceIndex);

      if (shouldSkipReference(rawUrl)) {
        return trimmed;
      }

      try {
        const absoluteUrl = new URL(rawUrl, baseUrl);
        const localPath = resolveLocalPath(absoluteUrl.href, fromRelativePath);
        if (!localPath) {
          return trimmed;
        }

        return `${localPath}${absoluteUrl.hash || ''}${descriptor}`;
      } catch (_error) {
        return trimmed;
      }
    })
    .join(', ');
}

function rewriteHtmlSnapshot(htmlText, pageUrl, resolveLocalPath) {
  const fromRelativePath = 'index.html';

  const rewriteValue = (rawValue) => {
    if (shouldSkipReference(rawValue)) {
      return rawValue;
    }

    try {
      const absoluteUrl = new URL(rawValue, pageUrl);
      const localPath = resolveLocalPath(absoluteUrl.href, fromRelativePath);
      if (!localPath) {
        return rawValue;
      }

      return `${localPath}${absoluteUrl.hash || ''}`;
    } catch (_error) {
      return rawValue;
    }
  };

  const rewriteAttributeOnTags = (inputHtml, tagPattern, attributeName, rewriter) => {
    const pattern = new RegExp(
      `(<(?:${tagPattern})\\b[^>]*?\\s${attributeName}\\s*=\\s*)(["'])([^"']*)(\\2)`,
      'gi'
    );

    return inputHtml.replace(pattern, (_match, prefix, quote, rawValue, suffix) => {
      const nextValue = rewriter(rawValue);
      return `${prefix}${quote}${nextValue}${suffix}`;
    });
  };

  let rewrittenHtml = htmlText.replace(/<base\b[^>]*>/gi, '');

  rewrittenHtml = rewriteAttributeOnTags(rewrittenHtml, 'link', 'href', rewriteValue);
  rewrittenHtml = rewriteAttributeOnTags(rewrittenHtml, 'script', 'src', rewriteValue);
  rewrittenHtml = rewriteAttributeOnTags(rewrittenHtml, 'img', 'src', rewriteValue);
  rewrittenHtml = rewriteAttributeOnTags(
    rewrittenHtml,
    'img|source',
    'srcset',
    (rawValue) => rewriteSrcsetText(rawValue, pageUrl, fromRelativePath, resolveLocalPath)
  );
  rewrittenHtml = rewriteAttributeOnTags(rewrittenHtml, 'source|audio|video|input', 'src', rewriteValue);
  rewrittenHtml = rewriteAttributeOnTags(rewrittenHtml, 'video', 'poster', rewriteValue);
  rewrittenHtml = rewriteAttributeOnTags(rewrittenHtml, 'object', 'data', rewriteValue);

  rewrittenHtml = rewrittenHtml.replace(
    /(<[^>]+\sstyle\s*=\s*)(["'])([\s\S]*?)(\2)/gi,
    (_match, prefix, quote, cssText, suffix) => {
      const nextCss = rewriteCssText(cssText, pageUrl, fromRelativePath, resolveLocalPath);
      return `${prefix}${quote}${nextCss}${suffix}`;
    }
  );

  rewrittenHtml = rewrittenHtml.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, prefix, cssText, suffix) => {
      const nextCss = rewriteCssText(cssText, pageUrl, fromRelativePath, resolveLocalPath);
      return `${prefix}${nextCss}${suffix}`;
    }
  );

  return rewrittenHtml;
}

async function autoScrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const maxDurationMs = 15000;
      const intervalMs = 250;
      const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
      let lastHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      let stableTicks = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, step);
        const currentHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        const nearBottom = window.innerHeight + window.scrollY >= currentHeight - 4;

        if (nearBottom) {
          if (currentHeight === lastHeight) {
            stableTicks += 1;
          } else {
            stableTicks = 0;
            lastHeight = currentHeight;
          }
        } else {
          stableTicks = 0;
          lastHeight = currentHeight;
        }

        if (stableTicks >= 3) {
          clearInterval(timer);
          resolve();
        }
      }, intervalMs);

      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, maxDurationMs);
    });

    window.scrollTo(0, 0);
  });
}

if (!url) {
  console.error('❌ 请提供一个URL作为参数！');
  console.log('示例: node url_save_as_html.js https://www.example.com');
  process.exit(1);
}

(async () => {
  const timestamp = getCnTimeISOString();
  const urlSlug = slugifyUrlForDir(url);
  const snapshotDir = path.join('html', `${timestamp}_${urlSlug}`);
  const entryHtmlPath = path.join(snapshotDir, 'index.html');
  const manifestPath = path.join(snapshotDir, 'manifest.json');

  ensureDirSync(snapshotDir);

  const usedRelativePaths = new Map();
  const resourcesByUrl = new Map();
  const urlAliases = new Map();
  const failedResources = [];
  const pendingWrites = new Set();
  let didAutoScroll = false;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );

  await page.setViewport({
    width: 1280,
    height: 800,
  });

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.resourceType() === 'font') {
      request.abort();
      return;
    }
    request.continue();
  });

  function registerAlias(aliasUrl, resource) {
    if (isHttpUrl(aliasUrl)) {
      urlAliases.set(normalizeLookupUrl(aliasUrl), resource.finalUrl);
    }
  }

  function resolveResourceByUrl(resourceUrl) {
    const lookupUrl = normalizeLookupUrl(resourceUrl);
    const canonicalUrl = urlAliases.get(lookupUrl) || lookupUrl;
    return resourcesByUrl.get(canonicalUrl) || null;
  }

  function resolveLocalPath(resourceUrl, fromRelativePath) {
    const resource = resolveResourceByUrl(resourceUrl);
    if (!resource) {
      return null;
    }

    const fromDir = path.posix.dirname(toPosixPath(fromRelativePath));
    const target = toPosixPath(resource.relativePath);
    const relativeReference = path.posix.relative(fromDir, target);
    return relativeReference || path.posix.basename(target);
  }

  async function saveResourceResponse(response) {
    const request = response.request();
    const resourceType = request.resourceType();

    if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return;
    }

    if (request.method() !== 'GET') {
      return;
    }

    const requestUrl = request.url();
    const finalUrl = response.url();

    if (!isHttpUrl(finalUrl)) {
      return;
    }

    const existing = resolveResourceByUrl(finalUrl);
    if (existing) {
      registerAlias(requestUrl, existing);
      registerAlias(finalUrl, existing);
      return;
    }

    const headers = response.headers();
    const contentType = getContentType(headers);
    const candidatePath = buildRelativeAssetPath(finalUrl, contentType);
    const relativePath = makeUniqueRelativePath(candidatePath, finalUrl, usedRelativePaths);
    const absolutePath = path.join(snapshotDir, ...relativePath.split('/'));

    try {
      const body = await response.buffer();
      ensureDirSync(path.dirname(absolutePath));
      fs.writeFileSync(absolutePath, body);

      const resource = {
        requestUrl,
        finalUrl,
        resourceType,
        contentType,
        relativePath,
        absolutePath,
        isTextLike: isTextLike(contentType),
      };

      resourcesByUrl.set(finalUrl, resource);
      registerAlias(finalUrl, resource);
      registerAlias(requestUrl, resource);
    } catch (error) {
      failedResources.push({
        request_url: requestUrl,
        final_url: finalUrl,
        resource_type: resourceType,
        error: error.message,
      });
    }
  }

  page.on('response', (response) => {
    const writePromise = saveResourceResponse(response).finally(() => {
      pendingWrites.delete(writePromise);
    });
    pendingWrites.add(writePromise);
  });

  async function flushPendingWrites() {
    while (pendingWrites.size > 0) {
      const currentWrites = Array.from(pendingWrites);
      await Promise.allSettled(currentWrites);
    }
  }

  try {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('timeout')) {
        console.warn(`页面等待 networkidle2 超时，继续保存当前已加载内容: ${error.message}`);
      } else {
        throw error;
      }
    }

    await delay(1200);
    await autoScrollToBottom(page);
    didAutoScroll = true;
    await delay(1800);
    await flushPendingWrites();

    for (const resource of resourcesByUrl.values()) {
      if (resource.resourceType !== 'stylesheet' || !resource.isTextLike) {
        continue;
      }

      const cssText = fs.readFileSync(resource.absolutePath, 'utf8');
      const rewrittenCss = rewriteCssText(
        cssText,
        resource.finalUrl,
        resource.relativePath,
        resolveLocalPath
      );
      fs.writeFileSync(resource.absolutePath, rewrittenCss, 'utf8');
    }

    const htmlContent = rewriteHtmlSnapshot(await page.content(), page.url(), resolveLocalPath);

    fs.writeFileSync(entryHtmlPath, htmlContent, 'utf8');

    const manifest = {
      snapshot_url: url,
      saved_at_cn: timestamp,
      entry_html: 'index.html',
      manifest_path: 'manifest.json',
      auto_scrolled: didAutoScroll,
      skipped_resource_types: ['font'],
      resource_counts: {
        saved: resourcesByUrl.size,
        failed: failedResources.length,
      },
      resources: Array.from(resourcesByUrl.values())
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
        .map((resource) => ({
          request_url: resource.requestUrl,
          final_url: resource.finalUrl,
          resource_type: resource.resourceType,
          content_type: resource.contentType,
          relative_path: toPosixPath(resource.relativePath),
        })),
      failed_resources: failedResources,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(entryHtmlPath);
  } catch (error) {
    console.error(`保存网页快照失败: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
