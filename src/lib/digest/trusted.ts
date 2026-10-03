/** 1媒体だけでも自動の速報にしてよい、信頼できる媒体（通信社・全国紙・在京テレビ局・大手スポーツ紙・専門の大手媒体） */
export const TRUSTED_PUBLISHERS =
  /NHK|時事|共同通信|朝日新聞|読売|毎日新聞|日本経済新聞|日経|産経|TBS|日テレ|テレ朝|FNN|フジテレビ|スポニチ|日刊スポーツ|スポーツ報知|サンケイスポーツ|デイリースポーツ|中日スポーツ|ゲキサカ|サッカーキング|Full-Count|oricon|オリコン|BBC/i;

export const isTrustedPublisher = (name: string) => TRUSTED_PUBLISHERS.test(name);
