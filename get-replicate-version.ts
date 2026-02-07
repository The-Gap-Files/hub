
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

async function main() {
  try {
    console.log("Fetching versions for lucataco/elevenlabs...");
    const versions = await replicate.models.versions.list("lucataco", "elevenlabs");
    console.log("Versions found:", versions.length);
    if (versions.length > 0) {
      console.log("Latest Version ID:", versions[0].id);
    }
  } catch (error) {
    console.error("Error fetching versions:", JSON.stringify(error, null, 2));
  }
}

main();
