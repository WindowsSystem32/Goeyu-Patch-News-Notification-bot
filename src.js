const scriptName = "_2023-09-07-0";
const RSS = 'https://rss.app/feeds/v1.1/aHyfxxgGbcce8w3J.json';
const dateToString = d => 
  d.getFullYear() + 
  '-' + 
  (d.getMonth() + 1 + '').padStart(2, 0) + 
  '-' + 
  (d.getDate() + '').padStart(2, 0) + 
  ' 오'+(d.getHours() >= 12? '후' : '전') + 
  ' '
  + (
    (d.getHours() > 12
      ?d.getHours() % 12
      : d.getHours()
    ) + '').padStart(2, 0) + 
  ':' + 
  (d.getMinutes() + '').padStart(2,0) + 
  ':' + 
  (d.getSeconds() + '').padStart(2,0);
const toUtc0 = date => {
  let d = new Date(date);
  return new Date(
    d.getTime() + 
    d.getTimezoneOffset() * 60000
  );
};
const processItem = item => 
  '제목: ' + 
  item.title + 
  '\n' + 
  '업로드 시간: ' + 
  dateToString(
    toUtc0(item.date_published)
  ) + 
  '\n' + 
  '링크: ' + 
  item.url;
const parseRSS = (onSuccess, onFail) => {
  if (
    !onSuccess && 
    typeof onSuccess != 'function'
  ) onSuccess = _ => _;
  if (
    !onFail && 
    typeof onFail != 'function'
  ) onFail = _ => _;
  try {
    return onSuccess(
      JSON.parse(
        org.jsoup.Jsoup
        .connect(RSS)
        .ignoreHttpErrors(true)
        .ignoreContentType(true)
        .get()
        .text()
      ).items
    );
  } catch (e) {
    return onFail(e);
  }
};
const errorHandler = (reply, err) => {
  if (reply)
    reply(
      '⛔️ 오류 발생 ⛔️' + 
      '\u200b'.repeat(500) + 
      '\n' + 
      err
    );
  Log.e(
    (e + '').slice(
      0, 
      -e.message.length - 2
    ) + 
    ' (#' + 
    e.lineNumber + 
    '):' + 
    '\n' + 
    e.message
  );
};
let rooms = [];
try {
  rooms = FileStream.read('/sdcard/rooms.txt').split('\n');
} catch (e) {}
let recentId = FileStream.read('/sdcard/recentId.txt');
const check = () => {
  //Log.d('최신 게시글 확인 중...');
  parseRSS(
    items => {
      if (items[0].id != recentId) {
        //새 게시글
        recentId = items[0].id;
        Log.d('게시글 올라옴: ' + recentId);
        FileStream.write('/sdcard/recentId.txt', recentId);
        const send = rooms.reduce((c, e) => 
          ((Api.replyRoom(
            e, 
            '새 글이 올라왔습니다!\n' + 
            processItem(items[0])
          ) || c.push(e)), c), 
          []
        );
        if (send.length) {
          Log.e(
            '알림 전송 실패:\n' + 
            send.join('\n')
          );
        }
      }
    }, 
    err => errorHandler(null, err)
  );
};
const delay = 2 * 60000; //최신글 확인 간격
let interval = setInterval(check, delay);
const modifyRooms = true; //챗으로 방 목록을 수정할 수 있는지에 대한 여부
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  try {
    if (msg == '/공지') {
      parseRSS(
        items => {
          replier.reply(
            '게시글 목록입니다.\n' + 
            '전체보기를 눌러 확인하세요!' + 
            '\u200b'.repeat(500) + 
            '\n' + 
            '---' + 
            '\n' + 
            items.map(processItem)
              .join(
                '\n' + 
                '---' + 
                '\n'
              ) + 
            '\n' + 
            '---'
          );
        }, 
        err => errorHandler(replier.reply, err)
      );
    } else {
      if (modifyRooms) {
        if (msg.startsWith('/알림방 ')) {
          msg = msg.split(' ');
          msg = [msg[1], msg.slice(2).join(' ').replace(/\n/g, '')];
          if (msg[0] == '목록') {
            replier.reply(
              '게시글 알림을 보낼 방' + 
              (rooms.length > 0
                ? (rooms.length > 1
                  ? ' 목록입니다.\n' + 
                    '전체보기를 눌러 확인하세요!' + 
                    '\u200b'.repeat(500) + 
                    '\n'
                  : '은 '
                  ) + 
                  rooms.join('\n')
                : '이 없습니다!'
              )
            );
          } else if (msg[0] == '추가') {
            if (rooms.includes(msg[1])) {
              replier.reply('❌️ 해당 방은 이미 목록에 포함되어 있습니다!');
              return;
            }
            rooms.push(msg[1]);
            save();
            replier.reply('✅️ 목록에 추가 완료!');
          } else if (msg[0] == '제거') {
            const index = rooms.indexOf(msg[1]);
            if (index === -1) {
              replier.reply('❌️ 해당 방은 목록에 없습니다!');
              return;
            }
            rooms.splice(index, 1);
            save();
            replier.reply('✅️ 목록에서 제거 완료!');
          }
        }
      }
    }
  } catch (err) {
    errorHandler(null, err);
  }
}

let timeoutId;
function save() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    FileStream.write('/sdcard/rooms.txt', rooms.join('\n'));
    timeoutId = null;
  }, 3000);
}

function onStartCompile() {
  interval && clearInterval(interval);
  interval = null;
}

function onCreate(savedInstanceState, activity) {
  let button = new android.widget.Button(activity);
  const toggle = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    } else {
      interval = setInterval(check, delay);
    }
    refresh();
  };
  const refresh = () => {
    button.text = 
      '인터벌 ' + 
      (interval
        ? '중지'
        : '시작'
      );
    const Color = android.graphics.Color;
    button.backgroundColor = interval
      ? Color.RED 
      : Color.GREEN;
    button.textColor = interval
      ? Color.WHITE 
      : Color.BLACK;
  };
  button.onClickListener = toggle;
  activity.setContentView(button);
  refresh();
}

function onStart(activity) {}

function onResume(activity) {}

function onPause(activity) {}

function onStop(activity) {}