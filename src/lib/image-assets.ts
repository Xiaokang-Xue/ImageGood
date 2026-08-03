const unsplash = (id: string, width = 1200, height = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&h=${height}&q=82`;

export const imageAssetSets = {
  products: [
    unsplash("1541643600914-78b084683601", 1000, 1000),
    unsplash("1522335789203-aabd1fc54bc9", 1000, 1000),
    unsplash("1556228720-195a672e8a03", 1000, 1000),
    unsplash("1523275335684-37898b6baf30", 1000, 1000)
  ],
  productScenes: [
    unsplash("1517705008128-361805f42e86", 1200, 900),
    unsplash("1497366754035-f200968a6e72", 1200, 900),
    unsplash("1509042239860-f550ce710b93", 1200, 900),
    unsplash("1513519245088-0e12902e5a38", 1200, 900)
  ],
  portraits: [
    unsplash("1494790108377-be9c29b29330", 900, 1100),
    unsplash("1507003211169-0a1dd7228f2d", 900, 1100)
  ],
  posters: [
    unsplash("1522202176988-66273c2fd55f", 900, 1200),
    unsplash("1517842645767-c639042777db", 900, 1200),
    unsplash("1456513080510-7bf3a84b82f8", 900, 1200),
    unsplash("1516321318423-f06f85e504b3", 900, 1200),
    unsplash("1497633762265-9d179a990aa6", 900, 1200),
    unsplash("1519389950473-47ba0277781c", 1200, 900)
  ],
  workspaces: [
    unsplash("1497366811353-6870744d04b2", 1200, 900),
    unsplash("1518005020951-eccb494ad742", 1200, 900),
    unsplash("1500530855697-b586d89ba3ee", 1200, 900)
  ]
};

export const homepageComparisonAssets = {
  productBackground: "/assets/images/comparisons/product-background.webp",
  posterText: "/assets/images/comparisons/poster-text.webp",
  objectRemoval: "/assets/images/comparisons/object-removal.webp"
} as const;

export const imageAssets = {
  original: imageAssetSets.products[0],
  edit1: imageAssetSets.products[1],
  edit2: imageAssetSets.productScenes[0],
  edit3: imageAssetSets.productScenes[2],
  product1: imageAssetSets.products[0],
  product2: imageAssetSets.productScenes[0],
  product3: imageAssetSets.productScenes[3],
  product4: imageAssetSets.products[2],
  poster1: imageAssetSets.posters[0],
  poster2: imageAssetSets.posters[1],
  poster3: imageAssetSets.posters[2],
  poster4: imageAssetSets.posters[3],
  poster5: imageAssetSets.posters[4],
  poster6: imageAssetSets.workspaces[1],
  portraitBusiness: imageAssetSets.portraits[0],
  posterStudy: imageAssetSets.posters[0],
  heroBackground: imageAssetSets.workspaces[2]
};
