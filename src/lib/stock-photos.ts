import type { Photo } from "./photo-data";

/**
 * 話題の内容に合わせた「イメージ写真」（Wikimedia Commons の自由利用ライセンスの写真。作者・ライセンスを表示する）。
 * 出来事そのものの写真ではないため、表示では「イメージ」と明記する。
 * 上から順に見出しの語（re）と照らし、最初に当たったものを使う。当たらなければ、そのジャンルの写真（genre）から話題ごとに選ぶ
 */
type StockPhoto = Photo & { re?: RegExp; genre?: string };

export const STOCK_PHOTOS: StockPhoto[] = [
  // diet
  { re: /国会|衆院|参院|衆議院|参議院|法案|与党|野党|自民|立憲|維新|公明|首相|内閣|閣議/, genre: "domestic", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/National_Diet_Building.jpg/500px-National_Diet_Building.jpg", page: "https://commons.wikimedia.org/wiki/File:National_Diet_Building.jpg", credit: "Kakidai / CC BY-SA 4.0" },
  // kantei
  { re: /官邸|官房長官|閣僚/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/%E7%B7%8F%E7%90%86%E5%AE%98%E9%82%B8_S%C5%8Dri_Kantei%2C_the_Prime_Minister%27s_office_-_panoramio.jpg/500px-%E7%B7%8F%E7%90%86%E5%AE%98%E9%82%B8_S%C5%8Dri_Kantei%2C_the_Prime_Minister%27s_office_-_panoramio.jpg", page: "https://commons.wikimedia.org/wiki/File:%E7%B7%8F%E7%90%86%E5%AE%98%E9%82%B8_S%C5%8Dri_Kantei,_the_Prime_Minister%27s_office_-_panoramio.jpg", credit: "AMANO Jun-ichi / CC BY 3.0" },
  // court
  { re: /最高裁|地裁|高裁|判決|裁判|訴訟|提訴/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Supreme_Court_of_Japan_%2810357245203%29.jpg/500px-Supreme_Court_of_Japan_%2810357245203%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Supreme_Court_of_Japan_(10357245203).jpg", credit: "Big Ben in Japan from Kawasaki, Japan / CC BY-SA 2.0" },
  // police
  { re: /警察|警視庁|県警|府警|逮捕|容疑|書類送検|捜査/, genre: "domestic", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Hokkaido_Police_Type_200_Patrol_Car.jpg/500px-Hokkaido_Police_Type_200_Patrol_Car.jpg", page: "https://commons.wikimedia.org/wiki/File:Hokkaido_Police_Type_200_Patrol_Car.jpg", credit: "Squadron / CC0" },
  // election
  { re: /選挙|投票|候補者|当選|落選|公約/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Hyogo_Gubernatorial_election_2024_poster_display_board.jpg/500px-Hyogo_Gubernatorial_election_2024_poster_display_board.jpg", page: "https://commons.wikimedia.org/wiki/File:Hyogo_Gubernatorial_election_2024_poster_display_board.jpg", credit: "JP-28207-3 / CC0" },
  // un
  { re: /国連|安保理|UNESCO|ユネスコ|WHO/, genre: "world", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/United_Nations_headquarters_3.jpg/500px-United_Nations_headquarters_3.jpg", page: "https://commons.wikimedia.org/wiki/File:United_Nations_headquarters_3.jpg", credit: "Horizon206 / CC0" },
  // whitehouse
  { re: /米大統領|ホワイトハウス|トランプ|米政権|米政府|米議会|米国務省/, genre: "world", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/White_House_lawn.jpg/500px-White_House_lawn.jpg", page: "https://commons.wikimedia.org/wiki/File:White_House_lawn.jpg", credit: "Daniel Schwen / CC BY-SA 3.0" },
  // globe
  { genre: "world", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/1794_Samuel_Dunn_Wall_Map_of_the_World_in_Hemispheres_-_Geographicus_-_World2-dunn-1794.jpg/500px-1794_Samuel_Dunn_Wall_Map_of_the_World_in_Hemispheres_-_Geographicus_-_World2-dunn-1794.jpg", page: "https://commons.wikimedia.org/wiki/File:1794_Samuel_Dunn_Wall_Map_of_the_World_in_Hemispheres_-_Geographicus_-_World2-dunn-1794.jpg", credit: "Thomas Kitchin / Public domain" },
  // stock
  { re: /株価|日経平均|東証|株式市場|上場|TOPIX|株主|株安|株高/, genre: "business", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/The_Tokyo_Stock_Exchange_-_main_room_2.jpg/500px-The_Tokyo_Stock_Exchange_-_main_room_2.jpg", page: "https://commons.wikimedia.org/wiki/File:The_Tokyo_Stock_Exchange_-_main_room_2.jpg", credit: "Kakidai / CC BY-SA 4.0" },
  // yen
  { re: /円安|円高|為替|ドル円|物価|インフレ|値上げ|賃上げ|給料|年収|NISA|投資|節約/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5f/10_Yen_%28Japan%29.jpg/500px-10_Yen_%28Japan%29.jpg", page: "https://commons.wikimedia.org/wiki/File:10_Yen_(Japan).jpg", credit: "AKS.9955 / Public domain" },
  // boj
  { re: /日銀|日本銀行|金利|利上げ|利下げ|金融政策/, genre: "business", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Bank_of_Japan_Head_Office_-_Main_building_from_south.jpg/500px-Bank_of_Japan_Head_Office_-_Main_building_from_south.jpg", page: "https://commons.wikimedia.org/wiki/File:Bank_of_Japan_Head_Office_-_Main_building_from_south.jpg", credit: "Hohoho / CC BY-SA 3.0" },
  // office
  { re: /決算|業績|売上|経営|社長|CEO|人事|採用|内定|転職|職場|企業/, genre: "business", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Shinkokusai_building.jpg/500px-Shinkokusai_building.jpg", page: "https://commons.wikimedia.org/wiki/File:Shinkokusai_building.jpg", credit: "Van2van / CC BY 4.0" },
  // smartphone
  { re: /スマホ|スマートフォン|iPhone|Android|アプリ|Pixel|Galaxy|Xperia/, genre: "tech", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/Hands-coffee-smartphone-technology_%2823698591814%29.jpg/500px-Hands-coffee-smartphone-technology_%2823698591814%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Hands-coffee-smartphone-technology_(23698591814).jpg", credit: "www.Pixel.la Free Stock Photos / CC0" },
  // chip
  { re: /半導体|チップ|GPU|CPU|NVIDIA|TSMC|ラピダス|量子/, genre: "tech", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Semiconductor_Wafer_of_Microelectronics.jpg/500px-Semiconductor_Wafer_of_Microelectronics.jpg", page: "https://commons.wikimedia.org/wiki/File:Semiconductor_Wafer_of_Microelectronics.jpg", credit: "DrHughManning / CC BY-SA 4.0" },
  // rocket
  { re: /ロケット|宇宙|JAXA|NASA|衛星|H3|探査機/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/H-IIA_F13_launching_KAGUYA.jpg/500px-H-IIA_F13_launching_KAGUYA.jpg", page: "https://commons.wikimedia.org/wiki/File:H-IIA_F13_launching_KAGUYA.jpg", credit: "Naritama (NARITA Masahiro) / CC BY 2.1 jp" },
  // laptop
  { re: /パソコン|PC|Windows|Mac|ノート|キーボード|ソフトウェア/, genre: "tech", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Laptop_keyboard_abstraction.jpg/500px-Laptop_keyboard_abstraction.jpg", page: "https://commons.wikimedia.org/wiki/File:Laptop_keyboard_abstraction.jpg", credit: "Martin Vorel / CC BY-SA 4.0" },
  // server
  { re: /AI|生成AI|ChatGPT|Gemini|クラウド|データセンター|サーバー|サイバー|不正アクセス|情報漏えい|情報漏洩|障害/, genre: "tech", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/DALL%C2%B7E_2025-01-31_21.58.22_-_A_realistic_image_of_the_interior_of_a_modern_data_center._The_scene_features_long_rows_of_tall%2C_sleek_server_racks_filled_with_blinking_LED_lights._T.webp/500px-thumbnail.webp", page: "https://commons.wikimedia.org/wiki/File:DALL%C2%B7E_2025-01-31_21.58.22_-_A_realistic_image_of_the_interior_of_a_modern_data_center._The_scene_features_long_rows_of_tall,_sleek_server_racks_filled_with_blinking_LED_lights._T.webp", credit: "Cbrasil0 / CC BY-SA 4.0" },
  // concert
  { re: /ライブ|コンサート|ツアー|アイドル|歌手|アーティスト|バンド|楽曲|紅白|音楽/, genre: "entertainment", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Beach-Please-2022-crowd-stage-lights-night-performance.jpg/500px-Beach-Please-2022-crowd-stage-lights-night-performance.jpg", page: "https://commons.wikimedia.org/wiki/File:Beach-Please-2022-crowd-stage-lights-night-performance.jpg", credit: "PinkBeachPlanet / CC BY-SA 4.0" },
  // cinema
  { re: /映画|劇場|興行収入|公開初日|試写会/, genre: "entertainment", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Empty_Movie_Theater_Seats_%2854279616742%29.jpg/500px-Empty_Movie_Theater_Seats_%2854279616742%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Empty_Movie_Theater_Seats_(54279616742).jpg", credit: "Eden, Janine and Jim from New York City / CC BY 2.0" },
  // microphone
  { re: /会見|インタビュー|番組|ラジオ|司会|MC|お笑い|芸人/, genre: "entertainment", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Gooseneck_microphone_on_podium_with_stage_bokeh_lights_01.jpg/500px-Gooseneck_microphone_on_podium_with_stage_bokeh_lights_01.jpg", page: "https://commons.wikimedia.org/wiki/File:Gooseneck_microphone_on_podium_with_stage_bokeh_lights_01.jpg", credit: "A S M Jobaer / CC BY-SA 4.0" },
];

/** 見出しとジャンルから、イメージ写真を選ぶ。同じジャンルの既定が複数あれば話題ごとに散らす */
export function stockPhoto(title: string, genreSlug: string, seed = 0): Photo | null {
  const byWord = STOCK_PHOTOS.filter((p) => p.re?.test(title));
  const pool = byWord.length > 0 ? byWord.slice(0, 1) : STOCK_PHOTOS.filter((p) => p.genre === genreSlug);
  const p = pool.length > 0 ? pool[Math.abs(seed) % pool.length] : null;
  return p ? { url: p.url, page: p.page, credit: p.credit } : null;
}
