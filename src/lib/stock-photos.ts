import type { Photo } from "./photo-data";

/**
 * 話題の内容に合わせた「イメージ写真」（Wikimedia Commons の自由利用ライセンスの写真。作者・ライセンスを表示する）。
 * 出来事そのものの写真ではないため、表示では「イメージ」と明記する。
 * 上から順に見出しの語（re）と照らし、最初に当たったものを使う。当たらなければ、そのジャンルの写真（genre）から話題ごとに選ぶ
 */
/** re: 見出しの語。scope: その語を見るジャンル（球団名などは企業や地名と同じ語のため、スポーツの話題に限る）。genre: そのジャンルの既定の写真 */
type StockPhoto = Photo & { re?: RegExp; scope?: string; genre?: string };

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
  // sumo
  { re: /相撲|大相撲|横綱|大関|関脇|小結|力士|親方/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Ryogoku_Kokugikan_painting_2_2013-08-29.jpg/500px-Ryogoku_Kokugikan_painting_2_2013-08-29.jpg", page: "https://commons.wikimedia.org/wiki/File:Ryogoku_Kokugikan_painting_2_2013-08-29.jpg", credit: "Guilhem Vellut / CC BY 2.0" },
  // boxing
  { re: /ボクシング|井上尚弥|世界王者|王座/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Set-up_of_a_boxing_Ring.jpg/500px-Set-up_of_a_boxing_Ring.jpg", page: "https://commons.wikimedia.org/wiki/File:Set-up_of_a_boxing_Ring.jpg", credit: "Micheal Kaluba / CC BY-SA 4.0" },
  // volleyball
  { re: /バレーボール|バレー|Vリーグ|SVリーグ/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Volleyball_match_-_shakehands_before_the_match.jpg/500px-Volleyball_match_-_shakehands_before_the_match.jpg", page: "https://commons.wikimedia.org/wiki/File:Volleyball_match_-_shakehands_before_the_match.jpg", credit: "Zorro2212 / CC BY-SA 3.0" },
  // basketball
  { re: /バスケットボール|バスケ|Bリーグ|NBA|八村|河村勇輝/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Tech-Cavaliers_Women%27s_Basketball_game_%282024-03-03%29.jpg/500px-Tech-Cavaliers_Women%27s_Basketball_game_%282024-03-03%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Tech-Cavaliers_Women%27s_Basketball_game_(2024-03-03).jpg", credit: "Sean Dudley / Public domain" },
  // tennis
  { re: /テニス|全豪|全仏|全英|全米オープン|ウィンブルドン|錦織|大坂なおみ/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Evening_tennis_match%2C_Kirkstall_Abbey_-_geograph.org.uk_-_6858907.jpg/500px-Evening_tennis_match%2C_Kirkstall_Abbey_-_geograph.org.uk_-_6858907.jpg", page: "https://commons.wikimedia.org/wiki/File:Evening_tennis_match,_Kirkstall_Abbey_-_geograph.org.uk_-_6858907.jpg", credit: "Stephen Craven / CC BY-SA 2.0" },
  // golf
  { re: /ゴルフ|PGA|LPGA|ツアー優勝|松山英樹/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Putting_green_at_the_Royal_Canberra_Golf_Club_4.JPG/500px-Putting_green_at_the_Royal_Canberra_Golf_Club_4.JPG", page: "https://commons.wikimedia.org/wiki/File:Putting_green_at_the_Royal_Canberra_Golf_Club_4.JPG", credit: "Neuroxic / CC BY 4.0" },
  // soccer
  { re: /サッカー|Jリーグ|J1|J2|プレミアリーグ|ラ・リーガ|セリエA|ブンデス|チャンピオンズリーグ|W杯|ワールドカップ|なでしこ|日本代表|ゴール|監督/, scope: "sports", genre: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/2019_J.League_Cup_Final.jpg/500px-2019_J.League_Cup_Final.jpg", page: "https://commons.wikimedia.org/wiki/File:2019_J.League_Cup_Final.jpg", credit: "ある男 / CC0" },
  // marathon
  { re: /マラソン|駅伝|陸上|箱根/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Tokyo_Marathon_2019_Runner_%2846349210105%29.jpg/500px-Tokyo_Marathon_2019_Runner_%2846349210105%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Tokyo_Marathon_2019_Runner_(46349210105).jpg", credit: "nakashi from Chofu, Tokyo, JAPAN / CC BY-SA 2.0" },
  // horse
  { re: /競馬|G1|ダービー|有馬記念|天皇賞|騎手|JRA/, scope: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Japan_Cup_2023_Goal.jpg/500px-Japan_Cup_2023_Goal.jpg", page: "https://commons.wikimedia.org/wiki/File:Japan_Cup_2023_Goal.jpg", credit: "Hatomizinko3 / CC BY 4.0" },
  // china
  { re: /中国|習近平|北京|中国外務省|台湾/, genre: "world", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Beijing_China_Tiananmen-Square-05.jpg/500px-Beijing_China_Tiananmen-Square-05.jpg", page: "https://commons.wikimedia.org/wiki/File:Beijing_China_Tiananmen-Square-05.jpg", credit: "CEphoto, Uwe Aranas / CC BY-SA 3.0" },
  // korea
  { re: /韓国|ソウル|北朝鮮|李在明/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Seoul_City_Wall_and_Downtown_Seoul.jpg/500px-Seoul_City_Wall_and_Downtown_Seoul.jpg", page: "https://commons.wikimedia.org/wiki/File:Seoul_City_Wall_and_Downtown_Seoul.jpg", credit: "서울연구원 / CC BY 4.0" },
  // russia
  { re: /ロシア|プーチン|モスクワ|クレムリン/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Vista_general_del_Kremlin%2C_Mosc%C3%BA%2C_Rusia%2C_2016-10-03%2C_DD_18-19_HDR.jpg/500px-Vista_general_del_Kremlin%2C_Mosc%C3%BA%2C_Rusia%2C_2016-10-03%2C_DD_18-19_HDR.jpg", page: "https://commons.wikimedia.org/wiki/File:Vista_general_del_Kremlin,_Mosc%C3%BA,_Rusia,_2016-10-03,_DD_18-19_HDR.jpg", credit: "Diego Delso / CC BY-SA 4.0" },
  // ukraine
  { re: /ウクライナ|ゼレンスキー|キーウ/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/%D0%92%D0%B8%D0%B4%D1%83%D0%B1%D0%B8%D1%86%D1%8C%D0%BA%D0%B8%D0%B9_%D0%BC%D0%BE%D0%BD%D0%B0%D1%81%D1%82%D0%B8%D1%80-3.JPG/500px-%D0%92%D0%B8%D0%B4%D1%83%D0%B1%D0%B8%D1%86%D1%8C%D0%BA%D0%B8%D0%B9_%D0%BC%D0%BE%D0%BD%D0%B0%D1%81%D1%82%D0%B8%D1%80-3.JPG", page: "https://commons.wikimedia.org/wiki/File:%D0%92%D0%B8%D0%B4%D1%83%D0%B1%D0%B8%D1%86%D1%8C%D0%BA%D0%B8%D0%B9_%D0%BC%D0%BE%D0%BD%D0%B0%D1%81%D1%82%D0%B8%D1%80-3.JPG", credit: "Nick Grapsy / CC BY-SA 4.0" },
  // usa
  { re: /米国|アメリカ|米連邦|米最高裁/, genre: "world", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/US_Capitol_west_side.JPG/500px-US_Capitol_west_side.JPG", page: "https://commons.wikimedia.org/wiki/File:US_Capitol_west_side.JPG", credit: "Martin Falbisoner / CC BY-SA 3.0" },
  // plane
  { re: /航空|旅客機|空港|ANA|JAL|欠航|航空便/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Airplane_at_airport_kochine_2.jpg/500px-Airplane_at_airport_kochine_2.jpg", page: "https://commons.wikimedia.org/wiki/File:Airplane_at_airport_kochine_2.jpg", credit: "रोहित साव27 / CC0" },
  // game
  { re: /ゲーム|Switch|PS5|プレイステーション|Xbox|Steam|任天堂|eスポーツ|DLC|攻略/, genre: "game", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Nintendo-Switch-Pro-Controller-FL.jpg/500px-Nintendo-Switch-Pro-Controller-FL.jpg", page: "https://commons.wikimedia.org/wiki/File:Nintendo-Switch-Pro-Controller-FL.jpg", credit: "Evan-Amos / Public domain" },
  // arcade
  { re: /アニメ|漫画|マンガ|コミック|声優|劇場版|秋葉原/, genre: "anime", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Pedestrians_Crossing%2C_Akihabara%2C_Tokyo%2C_Japan.jpg/500px-Pedestrians_Crossing%2C_Akihabara%2C_Tokyo%2C_Japan.jpg", page: "https://commons.wikimedia.org/wiki/File:Pedestrians_Crossing,_Akihabara,_Tokyo,_Japan.jpg", credit: "DLKR / CC0" },
  // ramen
  { re: /ラーメン|麺|うどん|そば|カップヌードル|焼きそば/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Ramen_Bowl_2.jpg/500px-Ramen_Bowl_2.jpg", page: "https://commons.wikimedia.org/wiki/File:Ramen_Bowl_2.jpg", credit: "Shisma / CC BY 4.0" },
  // burger
  { re: /バーガー|マクドナルド|モスバーガー|ロッテリア|ナゲット|ポテト/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Big_Mac_hamburger.jpg/500px-Big_Mac_hamburger.jpg", page: "https://commons.wikimedia.org/wiki/File:Big_Mac_hamburger.jpg", credit: "Evan-Amos / CC0" },
  // coffee
  { re: /コーヒー|カフェ|ラテ|スタバ|スターバックス|ドトール|コメダ|フラペチーノ/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Cup_of_coffee_with_latte_art_2016.jpg/500px-Cup_of_coffee_with_latte_art_2016.jpg", page: "https://commons.wikimedia.org/wiki/File:Cup_of_coffee_with_latte_art_2016.jpg", credit: "Abdulrohmatt / CC BY-SA 4.0" },
  // sweets
  { re: /スイーツ|ケーキ|パフェ|チョコ|アイス|ドーナツ|和菓子|プリン|クッキー|モンブラン/, genre: "products", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Piece_of_chocolate_cake_on_a_white_plate_decorated_with_chocolate_sauce.jpg/500px-Piece_of_chocolate_cake_on_a_white_plate_decorated_with_chocolate_sauce.jpg", page: "https://commons.wikimedia.org/wiki/File:Piece_of_chocolate_cake_on_a_white_plate_decorated_with_chocolate_sauce.jpg", credit: "Daria YakovlevaMinor edits made by Subsidiary account / CC0" },
  // convenience
  { re: /コンビニ|セブン|ローソン|ファミマ|ファミリーマート|新商品|新発売|期間限定/, genre: "products", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Hot_drinks_in_Japanese_Convenience_Store_%2813539630815%29.jpg/500px-Hot_drinks_in_Japanese_Convenience_Store_%2813539630815%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Hot_drinks_in_Japanese_Convenience_Store_(13539630815).jpg", credit: "Martin Lewison / CC BY-SA 2.0" },
  // shopping
  { re: /セール|ショッピング|商店街|百貨店|アウトレット|オープン/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Teramachi_Street_2022-04_ac_%287%29.jpg/500px-Teramachi_Street_2022-04_ac_%287%29.jpg", page: "https://commons.wikimedia.org/wiki/File:Teramachi_Street_2022-04_ac_(7).jpg", credit: "Asturio Cantabrio / CC BY-SA 4.0" },
  // shinkansen
  { re: /新幹線|JR|鉄道|列車|旅行|観光|ホテル|温泉|帰省/, genre: "life", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Line_scan_photo_of_Shinkansen_N700A_Series_Set_G13_in_2017%2C_car_16.png/500px-Line_scan_photo_of_Shinkansen_N700A_Series_Set_G13_in_2017%2C_car_16.png", page: "https://commons.wikimedia.org/wiki/File:Line_scan_photo_of_Shinkansen_N700A_Series_Set_G13_in_2017,_car_16.png", credit: "Dllu / CC BY-SA 4.0" },
  // hospital
  { re: /病院|医療|医師|感染|ワクチン|健康|がん|熱中症|厚労省/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Corridor_on_the_second_level_-_N%C3%84L_hospital_1.jpg/500px-Corridor_on_the_second_level_-_N%C3%84L_hospital_1.jpg", page: "https://commons.wikimedia.org/wiki/File:Corridor_on_the_second_level_-_N%C3%84L_hospital_1.jpg", credit: "W.carter / CC0" },
  // school
  { re: /学校|教育|受験|入試|大学|高校|中学|小学校|子育て/, url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Hitane_Elementary_School_classroom_1.jpg/500px-Hitane_Elementary_School_classroom_1.jpg", page: "https://commons.wikimedia.org/wiki/File:Hitane_Elementary_School_classroom_1.jpg", credit: "Douglas P Perkins / CC BY 3.0" },
  // home
  { re: /暮らし|家事|掃除|収納|節約|住宅|家賃|料理|レシピ/, genre: "life", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Interior_of_Shaw_house_-_Karuizawa%2C_Japan_-_DSC01944.JPG/500px-Interior_of_Shaw_house_-_Karuizawa%2C_Japan_-_DSC01944.JPG", page: "https://commons.wikimedia.org/wiki/File:Interior_of_Shaw_house_-_Karuizawa,_Japan_-_DSC01944.JPG", credit: "Daderot / CC0" },
  // sky
  { re: /天気|台風|大雨|気象|猛暑|雪|気温|紅葉/, genre: "life", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Field%2C_corn%2C_Liechtenstein%2C_Mountains%2C_Alps%2C_Vaduz%2C_sky%2C_clouds%2C_landscape.jpg/500px-Field%2C_corn%2C_Liechtenstein%2C_Mountains%2C_Alps%2C_Vaduz%2C_sky%2C_clouds%2C_landscape.jpg", page: "https://commons.wikimedia.org/wiki/File:Field,_corn,_Liechtenstein,_Mountains,_Alps,_Vaduz,_sky,_clouds,_landscape.jpg", credit: "Paranoid / Public domain" },
  // baseball
  { re: /野球|プロ野球|大リーグ|MLB|ドジャース|巨人|阪神|ヤクルト|ロッテ|ソフトバンク|日本ハム|楽天|西武|オリックス|広島|中日|DeNA|本塁打|投手|打者|甲子園/, scope: "sports", genre: "sports", url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/%E6%89%93%E7%8E%87%E3%81%A8%E6%9C%AC%E5%A1%81%E6%89%93%E6%95%B0_%283845206361%29.jpg/500px-%E6%89%93%E7%8E%87%E3%81%A8%E6%9C%AC%E5%A1%81%E6%89%93%E6%95%B0_%283845206361%29.jpg", page: "https://commons.wikimedia.org/wiki/File:%E6%89%93%E7%8E%87%E3%81%A8%E6%9C%AC%E5%A1%81%E6%89%93%E6%95%B0_(3845206361).jpg", credit: "Ethan Prater / CC BY 2.0" },
];

/** 見出しとジャンルから、イメージ写真を選ぶ。同じジャンルの既定が複数あれば話題ごとに散らす */
export function stockPhoto(title: string, genreSlug: string, seed = 0): Photo | null {
  const byWord = STOCK_PHOTOS.filter((p) => p.re?.test(title) && (!p.scope || p.scope === genreSlug));
  const pool = byWord.length > 0 ? byWord.slice(0, 1) : STOCK_PHOTOS.filter((p) => p.genre === genreSlug);
  const p = pool.length > 0 ? pool[Math.abs(seed) % pool.length] : null;
  return p ? { url: p.url, page: p.page, credit: p.credit } : null;
}
