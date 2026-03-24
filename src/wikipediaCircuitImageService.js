const WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/w/api.php';
const CIRCUIT_IMAGE_WIDTH = '1000';
const { sendTelegramMessage } = require('./telegramService');

async function fetchCircuitImage(wikipediaUrl) {
  if (!wikipediaUrl) return null;

  try {
    const pageTitle = getWikipediaPageTitle(wikipediaUrl);
    if (!pageTitle) return null;

    const imageFilename = await fetchCircuitImageFilenameFromInfobox(pageTitle);
    if (imageFilename) {
      const imageUrl = await fetchWikipediaImageUrl(imageFilename);
      if (imageUrl) {
        return imageUrl;
      }
    }

    const thumbnailUrl = await fetchWikipediaThumbnail(pageTitle);
    if (thumbnailUrl) {
      return thumbnailUrl;
    }

    await notifyCircuitImageFetchFailure(
      wikipediaUrl,
      'No infobox image or Wikipedia thumbnail was available.',
    );
    return null;
  } catch (err) {
    console.warn('Failed to fetch circuit image:', err);
    await notifyCircuitImageFetchFailure(wikipediaUrl, err.message);
    return null;
  }
}

async function notifyCircuitImageFetchFailure(wikipediaUrl, reason) {
  await sendTelegramMessage(
    `Warning: Failed to fetch circuit image URL for ${wikipediaUrl}. Reason: ${reason}`,
  );
}

function getWikipediaPageTitle(wikipediaUrl) {
  try {
    const parsedUrl = new URL(wikipediaUrl);
    const wikiPathPrefix = '/wiki/';
    if (!parsedUrl.pathname.startsWith(wikiPathPrefix)) {
      return null;
    }

    return decodeURIComponent(parsedUrl.pathname.slice(wikiPathPrefix.length));
  } catch {
    return null;
  }
}

async function fetchCircuitImageFilenameFromInfobox(pageTitle) {
  const data = await fetchWikipediaJson({
    action: 'parse',
    page: pageTitle,
    prop: 'wikitext',
    redirects: '1',
  });

  const wikitext = data.parse?.wikitext?.['*'];
  return (
    getInfoboxFileName(wikitext, 'image') ||
    getInfoboxFileName(wikitext, 'track_map')
  );
}

function getInfoboxFileName(wikitext, fieldName) {
  if (!wikitext || !fieldName) {
    return null;
  }

  const fieldPattern = new RegExp(
    `\\|\\s*${fieldName}\\s*=\\s*([^\\n\\r]+)`,
    'i',
  );
  const match = wikitext.match(fieldPattern);
  if (!match) {
    return null;
  }

  return normalizeWikipediaFileName(match[1]);
}

function normalizeWikipediaFileName(rawValue) {
  if (!rawValue) {
    return null;
  }

  const cleanedValue = rawValue
    .replace(/<!--.*?-->/g, '')
    .replace(/\{\{!}}/g, '|')
    .trim();

  const fileLinkMatch = cleanedValue.match(
    /\[\[(?:File|Image):([^|\]]+\.(?:svg|png|jpe?g|webp|gif))/i,
  );
  if (fileLinkMatch) {
    return fileLinkMatch[1].trim().replace(/ /g, '_');
  }

  const fileNameMatch = cleanedValue.match(
    /([^|<>{}[\]]+\.(?:svg|png|jpe?g|webp|gif))/i,
  );
  return fileNameMatch ? fileNameMatch[1].trim().replace(/ /g, '_') : null;
}

async function fetchWikipediaImageUrl(imageName) {
  const data = await fetchWikipediaJson({
    action: 'query',
    titles: `File:${imageName}`,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: CIRCUIT_IMAGE_WIDTH,
    redirects: '1',
  });

  const firstPage = getFirstWikipediaQueryPage(data);
  return firstPage?.imageinfo?.[0]?.thumburl || null;
}

async function fetchWikipediaThumbnail(pageTitle) {
  const data = await fetchWikipediaJson({
    action: 'query',
    titles: pageTitle,
    prop: 'pageimages',
    pithumbsize: '1000',
    redirects: '1',
  });

  const firstPage = getFirstWikipediaQueryPage(data);
  return firstPage?.thumbnail?.source || null;
}

async function fetchWikipediaJson(params) {
  const apiUrl = `${WIKIPEDIA_API_BASE}?${new URLSearchParams({
    ...params,
    format: 'json',
  }).toString()}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Wikipedia data: ${response.status}`);
  }

  return response.json();
}

function getFirstWikipediaQueryPage(data) {
  const pages = data.query?.pages;
  return pages ? pages[Object.keys(pages)[0]] : null;
}

module.exports = {
  fetchCircuitImage,
};
