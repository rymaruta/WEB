# ぜんぶナビの運用スクリプトの共通設定（source して使う）。秘密の値は画面に出さない
export AWS_DEFAULT_REGION=ap-northeast-1
ZN_ORIGIN=https://zenbu-navi.0abpk9f44v4wc.ap-northeast-1.cs.amazonlightsail.com
ZN_SITE=https://zenbu-navi.com
# ぜんぶナビの CloudFront（journey-photo の EYRLTGCPOS9E4 には絶対に触れない）
ZN_CF_DIST=EE92SZPTTPLE6
ZN_LOCAL_DB='postgresql://postgres@localhost:55432/zn?host=/tmp'
ZN_SCRATCH=${ZN_SCRATCH:-/tmp/zn-ops}
mkdir -p "$ZN_SCRATCH"
# CRON_SECRET を変数に読む（表示しない）
zn_secret() { aws ssm get-parameter --with-decryption --name /zenbu-navi/CRON_SECRET --query Parameter.Value --output text; }
