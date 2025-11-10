// ========================================
// WordPress用アンケートフォーム - Google Apps Script
// CORS対応完全版
// ========================================

// ========================================
// 設定値
// ========================================

// OpenAI APIキー（スクリプトプロパティから取得 - 必須）
// 設定方法: GASエディタ → プロジェクトの設定 → スクリプト プロパティ
// プロパティ名: OPENAI_API_KEY
// 値: あなたのOpenAI APIキー
const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

// セキュリティトークン（WordPress用）
const AUTH_TOKEN_WP = 'survey2024_secure_token_Gr0wUp_xyz789';

// スプレッドシート名
const SHEET_NAME = 'フォームの回答 1';

// ========================================
// Webアプリのエンドポイント
// ========================================

/**
 * GETリクエスト処理（プリフライトリクエスト対応）
 */
function doGet(e) {
  const response = {
    status: 'ok',
    message: 'Survey API is running',
    timestamp: new Date().toISOString()
  };

  return createJsonResponse(response);
}

/**
 * POSTリクエスト処理（メイン処理）
 */
function doPost(e) {
  try {
    // リクエストデータのパース
    let requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseError) {
      Logger.log('JSONパースエラー: ' + parseError.toString());
      return createJsonResponse({
        success: false,
        error: 'Invalid JSON format'
      });
    }

    // トークン認証
    if (!requestData.token || requestData.token !== AUTH_TOKEN_WP) {
      Logger.log('認証エラー: トークンが一致しません');
      return createJsonResponse({
        success: false,
        error: '認証エラー: 無効なトークンです'
      });
    }

    // アクションによって処理を分岐
    if (requestData.action === 'summarize') {
      return handleSummarize(requestData.answers);
    } else if (requestData.action === 'submit') {
      return handleSubmit(requestData.data);
    } else {
      Logger.log('不明なアクション: ' + requestData.action);
      return createJsonResponse({
        success: false,
        error: '不明なアクションです: ' + requestData.action
      });
    }

  } catch (error) {
    Logger.log('doPostエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    return createJsonResponse({
      success: false,
      error: 'サーバーエラー: ' + error.toString()
    });
  }
}

// ========================================
// WordPress用の処理関数
// ========================================

/**
 * 要約生成処理
 */
function handleSummarize(answers) {
  try {
    // 入力チェック
    if (!answers) {
      return createJsonResponse({
        success: false,
        error: '回答データがありません'
      });
    }

    // フルテキストの作成
    const fullText = `
【再生医療導入の経緯】
導入のきっかけ: ${answers.q1 || '（未回答）'}
サポート依頼の理由: ${answers.q2 || '（未回答）'}
他社との比較: ${answers.q3 || '（未回答）'}

【選定理由】
決め手: ${answers.q4 || '（未回答）'}

【サービス評価】
担当者の対応: ${answers.q5 || '（未回答）'}
サービス満足度: ${answers.q6 || '（未回答）'}

【推薦コメント】
${answers.q7 || '（未回答）'}
    `.trim();

    Logger.log('要約対象テキスト:\n' + fullText);

    // OpenAI APIで要約生成
    const summary = summarizeWithOpenAI(fullText);

    // エラーチェック
    if (summary.startsWith('エラー:')) {
      Logger.log('要約生成失敗: ' + summary);
      return createJsonResponse({
        success: false,
        error: summary
      });
    }

    Logger.log('要約生成成功: ' + summary);
    return createJsonResponse({
      success: true,
      summary: summary
    });

  } catch (error) {
    Logger.log('handleSummarizeエラー: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: '要約処理でエラーが発生しました: ' + error.toString()
    });
  }
}

/**
 * データ保存処理
 */
function handleSubmit(data) {
  try {
    // 入力チェック
    if (!data) {
      return createJsonResponse({
        success: false,
        error: '保存するデータがありません'
      });
    }

    // スプレッドシートを取得
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      Logger.log('シートが見つかりません: ' + SHEET_NAME);
      return createJsonResponse({
        success: false,
        error: 'スプレッドシートの取得に失敗しました'
      });
    }

    // 新しい行を追加
    const timestamp = new Date();
    const newRow = [
      timestamp,                // A列: タイムスタンプ
      data.facility || '',      // B列: 医療機関名
      data.position || '',      // C列: 役職
      data.name || '',          // D列: お名前
      data.q1 || '',            // E列: 質問①
      data.q2 || '',            // F列: 質問②
      data.q3 || '',            // G列: 質問③
      data.q4 || '',            // H列: 質問④
      data.q5 || '',            // I列: 質問⑤
      data.q6 || '',            // J列: 質問⑥
      data.q7 || '',            // K列: 質問⑦
      data.q8 || '',            // L列: 質問⑧
      data.q9 || '',            // M列: 質問⑨
      data.q10 || '',           // N列: 質問⑩
      data.summary || ''        // O列: 要約
    ];

    sheet.appendRow(newRow);

    Logger.log('データ保存成功: ' + data.name + ' (' + data.facility + ')');
    return createJsonResponse({
      success: true,
      message: 'アンケートを送信しました。ご協力ありがとうございました！'
    });

  } catch (error) {
    Logger.log('handleSubmitエラー: ' + error.toString());
    return createJsonResponse({
      success: false,
      error: 'データ保存でエラーが発生しました: ' + error.toString()
    });
  }
}

// ========================================
// OpenAI API連携
// ========================================

/**
 * OpenAI APIで要約生成
 */
function summarizeWithOpenAI(text) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `あなたは医療機関向けサービスのマーケティング担当者です。
お客様から頂いた生の声を、ホームページに掲載する「お客様の声」として編集する役割です。

【編集の方針】
・お客様の言葉をできるだけ活かす
・過度に称賛的にならず、自然な表現で
・具体的なエピソードや理由を含める
・読み手（他の医療機関）が共感できる内容に
・押しつけがましくない、自然な推薦文に

【NGな表現】
・「非常に素晴らしい」など大げさな表現
・「心からおすすめします」など過度な推薦
・定型的すぎる文章
・営業的な文言

【目指す雰囲気】
実際の利用者が、同業者に「ここ良かったよ」と
カジュアルに話しているような自然さ`
      },
      {
        role: 'user',
        content: `以下のアンケート回答を、ホームページの「お客様の声」として掲載できる形に編集してください。

【編集のポイント】
・導入を検討したきっかけ
・なぜグローアップを選んだのか
・実際に使ってみてどうだったか
・どんな医療機関におすすめか

文字数：180〜220文字程度
※無理に文字数を合わせる必要はありません。自然な文章を優先してください。

---アンケート回答---
${text}`
      }
    ],
    max_tokens: 500,
    temperature: 0.8,
    frequency_penalty: 0.3,
    presence_penalty: 0.2
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + OPENAI_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      const errorText = response.getContentText();
      Logger.log('OpenAI APIエラー (HTTP ' + responseCode + '): ' + errorText);

      // エラーの詳細をパース
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.message) {
          return 'エラー: ' + errorData.error.message;
        }
      } catch (e) {
        // パース失敗
      }

      return 'エラー: API呼び出し失敗 (コード: ' + responseCode + ')';
    }

    const data = JSON.parse(response.getContentText());

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      Logger.log('予期しないレスポンス形式: ' + JSON.stringify(data));
      return 'エラー: 要約生成失敗（レスポンス形式が不正）';
    }

  } catch (error) {
    Logger.log('OpenAI API例外エラー: ' + error.toString());
    return 'エラー: ' + error.toString();
  }
}

// ========================================
// ユーティリティ関数
// ========================================

/**
 * JSONレスポンスを作成（CORS対応）
 */
function createJsonResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  // 注意: GASのWebアプリは自動的にCORSヘッダーを追加します
  // 手動でヘッダーを追加する必要はありませんが、
  // デプロイ時に「アクセスできるユーザー: 全員」を選択する必要があります

  return output;
}

// ========================================
// テスト関数
// ========================================

/**
 * 要約機能のテスト
 */
function testSummarize() {
  const testAnswers = {
    q1: '患者様からの再生医療の要望が増えてきたため',
    q2: '申請手続きが複雑で専門家のサポートが必要だと感じたため',
    q3: '他社も検討しましたが実績で選びました',
    q4: '担当者の説明が丁寧でわかりやすかった',
    q5: '迅速に対応していただき助かりました',
    q6: '非常に満足しています',
    q7: '申請がスムーズに進むのでおすすめです'
  };

  const response = handleSummarize(testAnswers);
  Logger.log('===== 要約テスト結果 =====');
  Logger.log(response.getContent());
  Logger.log('========================');
}

/**
 * 保存機能のテスト
 */
function testSubmit() {
  const testData = {
    facility: 'テストクリニック',
    position: '院長',
    name: 'テスト太郎',
    q1: 'テスト回答1',
    q2: 'テスト回答2',
    q3: 'テスト回答3',
    q4: 'テスト回答4',
    q5: 'テスト回答5',
    q6: 'テスト回答6',
    q7: 'テスト回答7',
    q8: '希望する',
    q9: 'テスト紹介先',
    q10: 'テスト興味サービス',
    summary: 'これはテスト要約です'
  };

  const response = handleSubmit(testData);
  Logger.log('===== 保存テスト結果 =====');
  Logger.log(response.getContent());
  Logger.log('========================');
}

/**
 * 完全なdoPostテスト（要約）
 */
function testDoPostSummarize() {
  const testRequest = {
    postData: {
      contents: JSON.stringify({
        token: AUTH_TOKEN_WP,
        action: 'summarize',
        answers: {
          q1: '患者様からの再生医療の要望が増えてきたため',
          q2: '申請手続きが複雑で専門家のサポートが必要だと感じたため',
          q3: '他社も検討しましたが実績で選びました',
          q4: '担当者の説明が丁寧でわかりやすかった',
          q5: '迅速に対応していただき助かりました',
          q6: '非常に満足しています',
          q7: '申請がスムーズに進むのでおすすめです'
        }
      })
    }
  };

  const response = doPost(testRequest);
  Logger.log('===== doPost要約テスト結果 =====');
  Logger.log(response.getContent());
  Logger.log('==============================');
}

/**
 * 完全なdoPostテスト（保存）
 */
function testDoPostSubmit() {
  const testRequest = {
    postData: {
      contents: JSON.stringify({
        token: AUTH_TOKEN_WP,
        action: 'submit',
        data: {
          facility: 'テストクリニック',
          position: '院長',
          name: 'テスト太郎',
          q1: 'テスト回答1',
          q2: 'テスト回答2',
          q3: 'テスト回答3',
          q4: 'テスト回答4',
          q5: 'テスト回答5',
          q6: 'テスト回答6',
          q7: 'テスト回答7',
          q8: '希望する',
          q9: 'テスト紹介先',
          q10: 'テスト興味サービス',
          summary: 'これはテスト要約です'
        }
      })
    }
  };

  const response = doPost(testRequest);
  Logger.log('===== doPost保存テスト結果 =====');
  Logger.log(response.getContent());
  Logger.log('==============================');
}

// ========================================
// 【既存】Googleフォーム用の関数（互換性維持）
// ========================================

/**
 * フォーム送信時に自動実行される関数
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  // 要約対象の列を取得（E列〜K列）
  const q1 = sheet.getRange(lastRow, 5).getValue();
  const q2 = sheet.getRange(lastRow, 6).getValue();
  const q3 = sheet.getRange(lastRow, 7).getValue();
  const q4 = sheet.getRange(lastRow, 8).getValue();
  const q5 = sheet.getRange(lastRow, 9).getValue();
  const q6 = sheet.getRange(lastRow, 10).getValue();
  const q7 = sheet.getRange(lastRow, 11).getValue();

  const fullText = `
【再生医療導入の経緯】
導入のきっかけ: ${q1}
サポート依頼の理由: ${q2}
他社との比較: ${q3}

【選定理由】
決め手: ${q4}

【サービス評価】
担当者の対応: ${q5}
サービス満足度: ${q6}

【推薦コメント】
${q7}
  `.trim();

  const summary = summarizeWithOpenAI(fullText);
  sheet.getRange(lastRow, 15).setValue(summary);

  Logger.log('要約完了 - 行: ' + lastRow);
  Logger.log('要約内容: ' + summary);
}
