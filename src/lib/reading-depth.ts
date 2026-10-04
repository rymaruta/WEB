/**
 * 話題ページの読む長さ（30秒・3分・10分）の設定。切り替えの部品（src/components/reading-depth.tsx）と、
 * 表示の前に反映する <head> のスクリプトで共有する。
 * <head> のスクリプトはサーバーで HTML に書き込むため、"use client" のファイルではなくここに置く
 * （"use client" のファイルから読み込んだ値は、サーバーでは文字列として使えない）
 */
export const READING_DEPTH_KEY = "zn:depth";

/** 最初の描画の前に、保存された読む長さを反映する（<head> に置く） */
export const READING_DEPTH_SCRIPT = `try{var d=localStorage.getItem("${READING_DEPTH_KEY}");if(d==="30s"||d==="3m")document.documentElement.dataset.depth=d}catch(e){}`;
