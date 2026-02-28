# 足場見積システム

足場工事の見積を「現場で早く作る」「PDFは綺麗」「運用は社長不在でも回る」を目的に構築したWebシステムです。

## 技術スタック

- **フロントエンド/バックエンド**: Next.js 14 (App Router / TypeScript)
- **データベース**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **UI**: Tailwind CSS + shadcn/ui
- **PDF生成**: @react-pdf/renderer
- **ドラッグ&ドロップ**: @dnd-kit
- **デプロイ**: Vercel

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/[your-username]/ashiba-mitsumori-system.git
cd ashiba-mitsumori-system
npm install
```

### 2. 環境変数の設定

`.env.local` を作成して以下を設定：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_supabase_transaction_pooler_url
DIRECT_URL=your_supabase_direct_url
CRON_SECRET=your_cron_secret
```

### 3. データベースのセットアップ

```bash
# スキーマをDBに適用
npm run db:push

# 初期データ（単位マスター）を投入
npm run db:seed
```

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 にアクセス

## 主な機能

- **現場管理**: 仮現場の即時登録、会社・支店・担当者の紐付け
- **見積作成**: テンプレからワンクリック展開、階層構造（大項目→中項目→明細）
- **ステータス管理**: 下書き→確定→送付済→旧版の4状態
- **PDF生成**: 日本語対応の正式見積書PDF出力
- **改訂管理**: 版番号管理（-1, -2...）、旧版は閲覧専用
- **フォロー通知**: 送付後3営業日後の17時に自動通知
- **テンプレ管理**: ドラッグ&ドロップ並び替え、タグ管理
- **自動整理**: 14日更新なしの下書きを自動アーカイブ、アーカイブ後30日で自動削除

## DBコマンド

```bash
npm run db:migrate   # マイグレーション実行（開発）
npm run db:push      # スキーマを直接反映（開発初期）
npm run db:seed      # 初期データ投入
npm run db:studio    # Prisma Studio（DB GUI）
```
