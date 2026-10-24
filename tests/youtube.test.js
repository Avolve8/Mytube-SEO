const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load');

// Fixtures reproduisant la structure des réponses Innertube (champs utiles uniquement).
const videoRenderer = (id, extra = {}) => ({
  videoRenderer: {
    videoId: id,
    title: { runs: [{ text: 'Titre ' + id }] },
    ownerText: { runs: [{ text: 'Chaîne ' + id, navigationEndpoint: { browseEndpoint: { browseId: 'UC' + 'x'.repeat(22), canonicalBaseUrl: '/@chaine' } } }] },
    viewCountText: { simpleText: '1 234 567 vues' },
    shortViewCountText: { simpleText: '1,2 M de vues' },
    publishedTimeText: { simpleText: 'il y a 2 ans' },
    lengthText: { simpleText: '12:34' },
    ownerBadges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_VERIFIED' } }],
    detailedMetadataSnippets: [{ snippetText: { runs: [{ text: 'Une description' }] } }],
    thumbnail: {
      thumbnails: [
        { url: 'https://i.ytimg.com/a.jpg', width: 360 },
        { url: 'https://i.ytimg.com/b.jpg', width: 720 },
      ],
    },
    ...extra,
  },
});

const searchResponse = {
  estimatedResults: '1234567',
  refinements: ['crêpes faciles', 'crêpes sans lait'],
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  { adSlotRenderer: { videoRenderer: { videoId: 'AAAAAAAAAAA' } } },
                  videoRenderer('vid00000001'),
                  {
                    reelShelfRenderer: {
                      items: [
                        {
                          shortsLockupViewModel: {
                            entityId: 'shorts-shelf-item-shrt0000001',
                            overlayMetadata: { primaryText: { content: 'Un short' }, secondaryText: { content: '1,2 k vues' } },
                            onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: 'shrt0000001' } } },
                          },
                        },
                      ],
                    },
                  },
                  videoRenderer('vid00000002', {
                    viewCountText: { simpleText: '1 234 spectateurs' },
                    badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }],
                    publishedTimeText: undefined,
                  }),
                  {
                    lockupViewModel: {
                      contentId: 'lock0000001',
                      contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
                      contentImage: {
                        thumbnailViewModel: {
                          image: { sources: [{ url: 'https://i.ytimg.com/l.jpg', width: 480 }] },
                          overlays: [{ thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: '8:05' } }] } }],
                        },
                      },
                      metadata: {
                        lockupMetadataViewModel: {
                          title: { content: 'Vidéo lockup' },
                          image: {
                            decoratedAvatarViewModel: {
                              rendererContext: { commandContext: { onTap: { innertubeCommand: { browseEndpoint: { browseId: 'UCyyyyyyyyyyyyyyyyyyyyyy' } } } } },
                            },
                          },
                          metadata: {
                            contentMetadataViewModel: {
                              metadataRows: [
                                { metadataParts: [{ text: { content: 'Chaîne Lock' } }] },
                                { metadataParts: [{ text: { content: '45 k vues' } }, { text: { content: 'il y a 3 jours' } }] },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                  { lockupViewModel: { contentId: 'PLxxxx', contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' } },
                ],
              },
            },
            { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'NEXT_TOKEN' } } } },
          ],
        },
      },
    },
  },
};

test('parseSearch : vidéos, étagères, publicités, continuation', () => {
  const r = MT.yt.parseSearch(searchResponse);
  assert.equal(r.estimatedResults, 1234567);
  assert.equal(r.continuation, 'NEXT_TOKEN');
  assert.deepEqual(r.related, ['crêpes faciles', 'crêpes sans lait']);
  const ids = r.videos.map((v) => v.videoId);
  assert.deepEqual(ids, ['vid00000001', 'shrt0000001', 'vid00000002', 'lock0000001']);
  const v1 = r.videos[0];
  assert.equal(v1.views, 1234567);
  assert.equal(v1.ageSec, 2 * 365 * 86400);
  assert.equal(v1.durationSec, 754);
  assert.equal(v1.verified, true);
  assert.equal(v1.channelId, 'UC' + 'x'.repeat(22));
  assert.equal(v1.thumbnail, 'https://i.ytimg.com/b.jpg');
  assert.equal(v1.description, 'Une description');
  const short = r.videos[1];
  assert.equal(short.isShort, true);
  assert.equal(short.inShelf, true);
  assert.equal(short.views, 1200);
  const live = r.videos[2];
  assert.equal(live.isLive, true);
  assert.equal(live.views, null);
  assert.equal(live.watching, 1234);
  const lock = r.videos[3];
  assert.equal(lock.title, 'Vidéo lockup');
  assert.equal(lock.channelName, 'Chaîne Lock');
  assert.equal(lock.channelId, 'UCyyyyyyyyyyyyyyyyyyyyyy');
  assert.equal(lock.views, 45000);
  assert.equal(lock.ageSec, 3 * 86400);
  assert.equal(lock.durationSec, 485);
});

test('parsePlayer', () => {
  const r = MT.yt.parsePlayer({
    videoDetails: {
      videoId: 'abcdefghijk',
      title: 'T',
      shortDescription: 'D',
      keywords: ['a', 'b'],
      channelId: 'UCz',
      author: 'Auteur',
      viewCount: '42',
      lengthSeconds: '61',
      isLiveContent: false,
    },
    microformat: { playerMicroformatRenderer: { publishDate: '2024-01-05T08:00:03-08:00', category: 'Education', isFamilySafe: true } },
    playabilityStatus: { status: 'OK' },
  });
  assert.equal(r.views, 42);
  assert.deepEqual(r.tags, ['a', 'b']);
  assert.equal(r.durationSec, 61);
  assert.equal(r.category, 'Education');
  assert.equal(r.publishedAt, Date.parse('2024-01-05T08:00:03-08:00'));
});

test('parseNext : likes, commentaires, chaîne, jeton de commentaires', () => {
  const r = MT.yt.parseNext({
    contents: {
      twoColumnWatchNextResults: {
        results: {
          results: {
            contents: [
              {
                videoPrimaryInfoRenderer: {
                  dateText: { simpleText: '5 janv. 2024' },
                  videoActions: {
                    menuRenderer: {
                      topLevelButtons: [
                        {
                          segmentedLikeDislikeButtonViewModel: {
                            likeButtonViewModel: {
                              likeButtonViewModel: {
                                toggleButtonViewModel: {
                                  toggleButtonViewModel: {
                                    defaultButtonViewModel: { buttonViewModel: { title: '12 k', accessibilityText: "J'aime cette vidéo comme 12 345 autres personnes" } },
                                  },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                  viewCount: { videoViewCountRenderer: { viewCount: { simpleText: '1 000 vues' }, originalViewCount: '1000' } },
                },
              },
              {
                videoSecondaryInfoRenderer: {
                  owner: {
                    videoOwnerRenderer: {
                      title: { runs: [{ text: 'Ma chaîne' }] },
                      subscriberCountText: { simpleText: '1,2 k abonnés' },
                      navigationEndpoint: { browseEndpoint: { browseId: 'UCaaaaaaaaaaaaaaaaaaaaaa', canonicalBaseUrl: '/@ma' } },
                    },
                  },
                },
              },
              {
                itemSectionRenderer: {
                  sectionIdentifier: 'comment-item-section',
                  contents: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'COMMENTS_TOKEN' } } } }],
                },
              },
            ],
          },
        },
        secondaryResults: { secondaryResults: { results: [videoRenderer('rel00000001')] } },
      },
    },
    engagementPanels: [
      {
        engagementPanelSectionListRenderer: {
          panelIdentifier: 'engagement-panel-comments-section',
          header: { engagementPanelTitleHeaderRenderer: { contextualInfo: { runs: [{ text: '1 234' }] } } },
        },
      },
    ],
  });
  assert.equal(r.likes, 12345);
  assert.equal(r.views, 1000);
  assert.equal(r.comments, 1234);
  assert.equal(r.channel.subscribers, 1200);
  assert.equal(r.channel.channelId, 'UCaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(r.commentsToken, 'COMMENTS_TOKEN');
  assert.equal(r.related[0].videoId, 'rel00000001');
});

test('parseComments : entités (nouveau format) + continuation + en-tête', () => {
  const r = MT.yt.parseComments({
    onResponseReceivedEndpoints: [
      {
        reloadContinuationItemsCommand: {
          continuationItems: [
            {
              commentsHeaderRenderer: {
                countText: { runs: [{ text: '1 234' }, { text: ' commentaires' }] },
                sortMenu: {
                  sortFilterSubMenuRenderer: {
                    subMenuItems: [{ serviceEndpoint: { continuationCommand: { token: 'TOP' } } }, { serviceEndpoint: { continuationCommand: { token: 'NEW' } } }],
                  },
                },
              },
            },
          ],
        },
      },
      {
        reloadContinuationItemsCommand: {
          continuationItems: [
            {
              commentThreadRenderer: {
                commentViewModel: { commentViewModel: { commentKey: 'K1' } },
                replies: { commentRepliesRenderer: { contents: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'REPLIES' } } } }] } },
              },
            },
            {
              commentThreadRenderer: {
                comment: {
                  commentRenderer: {
                    commentId: 'old1',
                    contentText: { runs: [{ text: 'Ancien format' }] },
                    authorText: { simpleText: '@vieux' },
                    voteCount: { simpleText: '3' },
                    publishedTimeText: { runs: [{ text: 'il y a 1 jour' }] },
                  },
                },
              },
            },
            { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'PAGE2' } } } },
          ],
        },
      },
    ],
    frameworkUpdates: {
      entityBatchUpdate: {
        mutations: [
          {
            entityKey: 'K1',
            payload: {
              commentEntityPayload: {
                key: 'K1',
                properties: { commentId: 'c1', content: { content: 'Super vidéo !' }, publishedTime: 'il y a 2 jours', replyLevel: 0 },
                author: { displayName: '@fan', channelId: 'UCfan', isCreator: false },
                toolbar: { likeCountNotliked: '1,2 k', replyCount: '4' },
              },
            },
          },
        ],
      },
    },
  });
  assert.equal(r.total, 1234);
  assert.equal(r.sortNewToken, 'NEW');
  assert.equal(r.next, 'PAGE2');
  assert.equal(r.comments.length, 2);
  assert.deepEqual(
    { id: r.comments[0].id, text: r.comments[0].text, author: r.comments[0].author, likes: r.comments[0].likes, replies: r.comments[0].replies },
    { id: 'c1', text: 'Super vidéo !', author: '@fan', likes: 1200, replies: 4 }
  );
  assert.equal(r.comments[1].text, 'Ancien format');
  assert.equal(r.comments[1].likes, 3);
});

test('parseChannel (nouvel en-tête) et parseAbout', () => {
  const ch = MT.yt.parseChannel({
    metadata: {
      channelMetadataRenderer: {
        title: 'Ma chaîne',
        description: 'Desc',
        keywords: 'cuisine "recette facile"',
        externalId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
        vanityChannelUrl: 'http://www.youtube.com/@ma',
        avatar: { thumbnails: [{ url: 'https://yt3/a.jpg', width: 900 }] },
      },
    },
    header: {
      pageHeaderRenderer: {
        content: {
          pageHeaderViewModel: {
            metadata: {
              contentMetadataViewModel: {
                metadataRows: [
                  { metadataParts: [{ text: { content: '@ma' } }] },
                  { metadataParts: [{ text: { content: '12,3 k abonnés' } }, { text: { content: '345 vidéos' } }] },
                ],
              },
            },
            banner: { imageBannerViewModel: { image: { sources: [{ url: 'https://yt3/banner.jpg', width: 2560 }] } } },
            description: {
              descriptionPreviewViewModel: {
                rendererContext: {
                  commandContext: {
                    onTap: {
                      innertubeCommand: {
                        showEngagementPanelEndpoint: {
                          engagementPanel: {
                            engagementPanelSectionListRenderer: {
                              content: {
                                sectionListRenderer: {
                                  contents: [
                                    { itemSectionRenderer: { contents: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'ABOUT' } } } }] } },
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [{ tabRenderer: { title: 'Vidéos', endpoint: { browseEndpoint: { params: 'PARAMS_VIDEOS' }, commandMetadata: { webCommandMetadata: { url: '/@ma/videos' } } } } }],
      },
    },
  });
  assert.equal(ch.subscribers, 12300);
  assert.equal(ch.videoCount, 345);
  assert.equal(ch.handle, '@ma');
  assert.equal(ch.aboutToken, 'ABOUT');
  assert.deepEqual(ch.keywords, ['cuisine', 'recette facile']);
  assert.equal(ch.banner, 'https://yt3/banner.jpg');
  assert.equal(ch.tabs[0].params, 'PARAMS_VIDEOS');

  const about = MT.yt.parseAbout({
    onResponseReceivedEndpoints: [
      {
        appendContinuationItemsAction: {
          continuationItems: [
            {
              aboutChannelRenderer: {
                metadata: {
                  aboutChannelViewModel: {
                    description: 'À propos',
                    country: 'France',
                    viewCountText: '1 234 567 vues',
                    joinedDateText: { content: 'Inscrit le 5 mars 2010' },
                    subscriberCountText: '12,3 k abonnés',
                    videoCountText: '345 vidéos',
                    links: [{ channelExternalLinkViewModel: { title: { content: 'Instagram' }, link: { content: 'instagram.com/ma' } } }],
                  },
                },
              },
            },
          ],
        },
      },
    ],
  });
  assert.equal(about.views, 1234567);
  assert.equal(about.joinedAt, Date.UTC(2010, 2, 5));
  assert.equal(about.country, 'France');
  assert.deepEqual(about.links, [{ title: 'Instagram', url: 'https://instagram.com/ma' }]);
});

test('parseRss', () => {
  const xml = `<?xml version="1.0"?><feed><title>Ma chaîne &amp; co</title><yt:channelId>UCaaaaaaaaaaaaaaaaaaaaaa</yt:channelId>
  <entry><id>yt:video:abcdefghijk</id><yt:videoId>abcdefghijk</yt:videoId><yt:channelId>UCaaaaaaaaaaaaaaaaaaaaaa</yt:channelId><title>Vidéo &quot;1&quot;</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/abcdefghijk"/><published>2024-05-01T10:00:00+00:00</published><updated>2024-05-02T10:00:00+00:00</updated>
  <media:group><media:title>Vidéo 1</media:title><media:thumbnail url="https://i1.ytimg.com/vi/abcdefghijk/hqdefault.jpg" width="480" height="360"/><media:description>Desc &lt;b&gt;</media:description>
  <media:community><media:starRating count="12" average="5.00" min="1" max="5"/><media:statistics views="3456"/></media:community></media:group></entry></feed>`;
  const r = MT.yt.parseRss(xml);
  assert.equal(r.title, 'Ma chaîne & co');
  assert.equal(r.entries.length, 1);
  assert.deepEqual(
    { id: r.entries[0].videoId, title: r.entries[0].title, views: r.entries[0].views, likes: r.entries[0].likes, short: r.entries[0].isShort, desc: r.entries[0].description },
    { id: 'abcdefghijk', title: 'Vidéo "1"', views: 3456, likes: 12, short: true, desc: 'Desc <b>' }
  );
  assert.equal(r.entries[0].publishedAt, Date.parse('2024-05-01T10:00:00+00:00'));
});

test('parseSuggest : JSON et JSONP', () => {
  assert.deepEqual(MT.yt.parseSuggest('["crepe",["crepe facile","crepe sans lait"]]'), ['crepe facile', 'crepe sans lait']);
  assert.deepEqual(MT.yt.parseSuggest('window.google.ac.h(["crepe",[["crepe facile",0,[512]],["crepe salée",0]],{"k":1}])'), ['crepe facile', 'crepe salée']);
  assert.deepEqual(MT.yt.parseSuggest('nope'), []);
});

test('extractJson lit ytInitialData dans le HTML', () => {
  const html = '<script>var ytInitialData = {"a":{"b":"x}y"},"c":[1,2]};</script><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abc"}};</script>';
  assert.deepEqual(MT.yt.extractJson(html, 'ytInitialData'), { a: { b: 'x}y' }, c: [1, 2] });
  assert.equal(MT.yt.extractJson(html, 'ytInitialPlayerResponse').videoDetails.videoId, 'abc');
  assert.equal(MT.yt.extractJson(html, 'absent'), null);
});

test('channelStats fusionne RSS et vidéos', () => {
  const now = Date.now();
  const s = MT.yt.channelStats({
    subscribers: 1000,
    videos: [
      { videoId: 'a', views: 100, ageSec: 86400 },
      { videoId: 'b', views: 300, ageSec: 8 * 86400 },
    ],
    rss: [
      { videoId: 'a', publishedAt: now - 86400000, views: 90 },
      { videoId: 'c', publishedAt: now - 15 * 86400000, views: 200 },
    ],
  });
  assert.equal(s.videos.length, 3);
  assert.equal(s.medianViews, 200);
  assert.ok(s.uploadsPerWeek > 0);
});

test('channelStats : rythme de publication basé sur les publications récentes', () => {
  const now = Date.now();
  const day = 86400000;
  // 15 vidéos récentes (1 tous les 2 jours) + de vieilles vidéos espacées de plusieurs mois
  const rss = Array.from({ length: 15 }, (_, i) => ({ videoId: 'r' + i, publishedAt: now - i * 2 * day, views: 100 }));
  const videos = Array.from({ length: 10 }, (_, i) => ({ videoId: 'o' + i, views: 50, ageSec: (400 + i * 90) * 86400 }));
  const s = MT.yt.channelStats({ subscribers: 100, videos, rss });
  assert.ok(Math.abs(s.uploadsPerWeek - 3.5) < 0.01, String(s.uploadsPerWeek));
});
