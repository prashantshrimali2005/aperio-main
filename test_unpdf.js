const { extractText } = require("unpdf");

async function run() {
  const bytes = new Uint8Array(Buffer.from("%PDF-1.4\n%EOF\n"));
  try {
    const res = await extractText(bytes, { mergePages: true });
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
