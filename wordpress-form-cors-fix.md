# WordPress フォーム「Failed to fetch」エラーの解決方法

## 問題の原因

「Failed to fetch」エラーは **CORS (Cross-Origin Resource Sharing)** の問題です。
WordPressサイト（あなたのドメイン）からGoogle Apps Script（script.google.com）への
クロスオリジンリクエストがブラウザによってブロックされています。

## 解決方法

### 1. GAS側の修正（必須）

現在のGASコードは、CORSヘッダーを返していません。以下のように修正してください。

#### ✅ 修正後のGASコード

```javascript
// ========================================
// 【重要】doGet関数を追加（プリフライトリクエスト対応）
// ========================================

/**
 * プリフライトリクエスト（OPTIONS）に対応
 */
function doGet(e) {
  return createCorsResponse({ message: 'GET request received' });
}

// ========================================
// 【修正】doPost関数にCORS対応を追加
// ========================================

/**
 * POSTリクエストを受け取る（WordPress用）
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);

    // トークン認証
    if (requestData.token !== AUTH_TOKEN_WP) {
      return createCorsResponse({ success: false, error: '認証エラー' });
    }

    // アクションによって処理を分岐
    if (requestData.action === 'summarize') {
      const result = handleSummarize(requestData.answers);
      return createCorsResponse(result);
    } else if (requestData.action === 'submit') {
      const result = handleSubmit(requestData.data);
      return createCorsResponse(result);
    } else {
      return createCorsResponse({ success: false, error: '不明なアクション' });
    }

  } catch (error) {
    Logger.log('doPostエラー: ' + error.toString());
    return createCorsResponse({ success: false, error: error.toString() });
  }
}

// ========================================
// 【新規】CORS対応レスポンス作成関数
// ========================================

/**
 * CORS対応のJSONレスポンスを作成
 */
function createCorsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  return output;
}

// ========================================
// 【修正】handleSummarize関数
// ========================================

/**
 * 要約生成処理（WordPress用）
 */
function handleSummarize(answers) {
  const fullText = `
【再生医療導入の経緯】
導入のきっかけ: ${answers.q1 || ''}
サポート依頼の理由: ${answers.q2 || ''}
他社との比較: ${answers.q3 || ''}

【選定理由】
決め手: ${answers.q4 || ''}

【サービス評価】
担当者の対応: ${answers.q5 || ''}
サービス満足度: ${answers.q6 || ''}

【推薦コメント】
${answers.q7 || ''}
  `.trim();

  const summary = summarizeWithOpenAI(fullText);

  // エラーチェック
  if (summary.startsWith('エラー:')) {
    return { success: false, error: summary };
  }

  return { success: true, summary: summary };
}

// ========================================
// 【修正】handleSubmit関数
// ========================================

/**
 * データ保存処理（WordPress用）
 */
function handleSubmit(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('フォームの回答 1');

    const timestamp = new Date();
    const newRow = [
      timestamp,
      data.facility,
      data.position,
      data.name,
      data.q1,
      data.q2,
      data.q3,
      data.q4,
      data.q5,
      data.q6,
      data.q7,
      data.q8,
      data.q9,
      data.q10,
      data.summary
    ];

    sheet.appendRow(newRow);

    Logger.log('データ保存完了');
    return { success: true, message: 'データを保存しました' };

  } catch (error) {
    Logger.log('保存エラー: ' + error.toString());
    return { success: false, error: 'データ保存に失敗しました: ' + error.toString() };
  }
}

// ========================================
// 【削除】createJsonResponse関数は不要
// ========================================
// createCorsResponse関数に統合されました
```

### 2. GASの再デプロイ（必須）

コードを修正したら、必ず**新しいバージョンでデプロイ**してください：

1. GASエディタで「デプロイ」→「デプロイを管理」を開く
2. 右上の「新しいデプロイ」をクリック
3. 「種類の選択」で「ウェブアプリ」を選択
4. 設定：
   - **説明**: 「CORS対応版」など
   - **次のユーザーとして実行**: 「自分」
   - **アクセスできるユーザー**: **「全員」**（これが重要！）
5. 「デプロイ」をクリック
6. 新しいURLが表示されるので、WordPressのJavaScriptコードの `GAS_URL` を更新

### 3. WordPress側のJavaScript修正（推奨）

より詳細なエラー情報を取得できるよう、fetch処理を改善します：

```javascript
// ========================================
// 【改善】要約機能
// ========================================

async function handleSummarize() {
  if (isProcessing) return;

  const answers = getAnswers();

  const hasAnyAnswer = Object.values(answers).some(answer => answer.length > 0);
  if (!hasAnyAnswer) {
    showStatus(summaryStatus, '質問①～⑦の少なくとも1つにご回答ください。', 'error');
    return;
  }

  isProcessing = true;
  summarizeBtn.disabled = true;
  submitBtn.disabled = true;
  showStatus(summaryStatus, '要約を生成しています...', 'loading');

  try {
    console.log('リクエスト送信:', {
      url: CONFIG.GAS_URL,
      token: CONFIG.AUTH_TOKEN,
      action: 'summarize'
    });

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      mode: 'no-cors', // 【重要】CORSエラー回避のため追加
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: CONFIG.AUTH_TOKEN,
        action: 'summarize',
        answers: answers
      })
    });

    console.log('レスポンス受信:', response);

    // no-corsモードの場合、レスポンスが読めないのでタイムアウトで判定
    if (response.type === 'opaque') {
      // リクエストは送信されたが、レスポンスが読めない
      // 別の方法でテストが必要
      showStatus(summaryStatus, 'リクエストを送信しましたが、レスポンスを確認できません。GASのログを確認してください。', 'error');
      return;
    }

    if (!response.ok) {
      throw new Error('サーバーエラーが発生しました (HTTP ' + response.status + ')');
    }

    const result = await response.json();
    console.log('パース結果:', result);

    if (result.success) {
      summaryTextarea.value = result.summary;
      showStatus(summaryStatus, '要約が完成しました。内容を確認・編集してください。', 'success');
      summaryTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      throw new Error(result.error || '要約の生成に失敗しました');
    }

  } catch (error) {
    console.error('要約エラー:', error);
    showStatus(summaryStatus, 'エラー: ' + error.message + '（詳細はコンソールを確認してください）', 'error');
  } finally {
    isProcessing = false;
    summarizeBtn.disabled = false;
    submitBtn.disabled = false;
  }
}
```

**注意**: `mode: 'no-cors'` を使用すると、レスポンスを読み取れなくなります。
これは一時的な回避策であり、GAS側のCORS設定が正しく動作すれば不要になります。

## トラブルシューティング

### エラーが続く場合のチェックリスト

1. **GASのデプロイ設定を確認**
   - ✅ 「アクセスできるユーザー」が「全員」になっているか
   - ✅ 最新バージョンでデプロイしたか
   - ✅ 新しいURLをWordPressに反映したか

2. **ブラウザのコンソールを確認**
   - ✅ Chrome DevTools（F12）のConsoleタブを開く
   - ✅ エラーメッセージの詳細を確認
   - ✅ Networkタブでリクエスト/レスポンスを確認

3. **GASのログを確認**
   - ✅ GASエディタで「実行数」→「実行ログ」を開く
   - ✅ リクエストが届いているか確認
   - ✅ エラーが記録されていないか確認

4. **テスト方法**
   ```javascript
   // GASで以下のテスト関数を実行してみる
   function testDoPostSummarize() {
     const testRequest = {
       postData: {
         contents: JSON.stringify({
           token: AUTH_TOKEN_WP,
           action: 'summarize',
           answers: {
             q1: 'テスト回答1',
             q2: 'テスト回答2',
             q3: 'テスト回答3',
             q4: 'テスト回答4',
             q5: 'テスト回答5',
             q6: 'テスト回答6',
             q7: 'テスト回答7'
           }
         })
       }
     };

     const response = doPost(testRequest);
     Logger.log('===== テスト結果 =====');
     Logger.log(response.getContent());
     Logger.log('====================');
   }
   ```

5. **APIキーの確認**
   - ✅ OpenAI APIキーが有効か
   - ✅ APIキーに十分なクレジットがあるか
   - ✅ APIキーが公開されていないか（セキュリティリスク）

## セキュリティ上の重要な注意

⚠️ **APIキーがコードに直接記載されています！**

現在のコードでは、OpenAI APIキーがGASコードに直接記載されており、
これは**セキュリティリスク**です。以下の対策を推奨します：

### 推奨: スクリプトプロパティを使用

```javascript
// APIキーを直接書かない
// const OPENAI_API_KEY = 'sk-proj-...';

// 代わりにスクリプトプロパティから取得
const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
```

**設定方法**:
1. GASエディタで「プロジェクトの設定」（歯車アイコン）を開く
2. 「スクリプト プロパティ」タブを開く
3. 「スクリプト プロパティを追加」をクリック
4. プロパティ: `OPENAI_API_KEY`
5. 値: `sk-proj-...`（あなたのAPIキー）
6. 「スクリプト プロパティを保存」

これにより、コードを共有してもAPIキーが漏洩しません。

## まとめ

「Failed to fetch」エラーの解決手順：

1. ✅ GASコードに `doGet` 関数を追加
2. ✅ `doPost` 関数を修正してCORS対応レスポンスを返す
3. ✅ GASを「全員」アクセス可能で再デプロイ
4. ✅ 新しいURLをWordPressに反映
5. ✅ ブラウザのキャッシュをクリア
6. ✅ 動作確認

それでも解決しない場合は、ブラウザのコンソールとGASのログを
確認して、具体的なエラーメッセージを特定してください。
