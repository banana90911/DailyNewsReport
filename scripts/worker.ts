import { runDueSchedules } from "@/lib/report-pipeline";

async function main() {
  const result = await runDueSchedules();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
