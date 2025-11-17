// Sitemap generation script
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as parser from "@babel/parser";
import { createRequire } from "module";
import type { NodePath } from "@babel/traverse";
import { JSXAttribute, JSXIdentifier, JSXOpeningElement } from "@babel/types";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default || require("@babel/traverse");

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ———————————————
// CONFIGURATION
// ———————————————

// ⚠ 1. website url (Do not forget to replace this with your own url)
// Set VITE_APP_URL environment variable or update this default
const BASE_URL = process.env.VITE_APP_URL || process.env.APP_URL || "https://floraiqcrm.com";

// ⚠ 2. input path (App.tsx contains all routes)
const ROUTER_FILE_PATH = path.resolve(__dirname, "../App.tsx");

// ⚠ 3. SET THE OUTPUT FOLDER (default is 'public' at project root)
const OUTPUT_DIR = path.resolve(__dirname, "../../public");

// ⚠ 4. PATHS TO IGNORE (exact matches or patterns with wildcards)
const IGNORE_PATHS: string[] = [
  "/dashboard/*",
  "/admin/*",
  "/:tenantSlug/*",
  "/community/approval",
  "/community/create",
  "/customer/*",
  "/courier/*",
  "/super-admin/*",
  "/tenant-admin/*",
  "/saas/*",
  // add more paths here
];

// ———————————————
// SITEMAP SCRIPT
// ———————————————

const SITEMAP_PATH = path.join(OUTPUT_DIR, "sitemap.xml");

/**
 * Finds the value of a JSX attribute (e.g., path="/foo")
 */
function getAttributeValue(
  astPath: NodePath<JSXOpeningElement>,
  attributeName: string
): string | null {
  const attribute = astPath.node.attributes.find(
    (attr): attr is JSXAttribute =>
      attr.type === "JSXAttribute" && attr.name.name === attributeName
  );

  if (!attribute) {
    return null;
  }

  const value = attribute.value;
  if (value?.type === "StringLiteral") {
    return value.value;
  }
  return null;
}

/**
 * Joins path segments into a clean URL path.
 */
function joinPaths(paths: string[]): string {
  if (paths.length === 0) return "/";

  const joined = paths.join("/");

  // Clean up double slashes and trailing slashes
  const cleaned = ("/" + joined).replace(/\/+/g, "/"); // Replace // with /

  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    return cleaned.slice(0, -1); // Remove trailing slash
  }

  return cleaned;
}

/**
 * Checks if a route should be ignored based on IGNORE_PATHS configuration
 */
function shouldIgnoreRoute(route: string): boolean {
  for (const ignorePattern of IGNORE_PATHS) {
    // Exact match
    if (ignorePattern === route) {
      return true;
    }

    // Wildcard pattern match (e.g., "/api/*" matches "/api/auth/callback")
    if (ignorePattern.endsWith("/*")) {
      const prefix = ignorePattern.slice(0, -2); // Remove "/*"
      if (route.startsWith(prefix + "/") || route === prefix) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Generates the XML content for the sitemap
 */
function createSitemapXml(routes: string[]): string {
  const today = new Date().toISOString().split("T")[0];

  const urls = routes
    .map((route) => {
      const fullUrl = new URL(route, BASE_URL).href;
      return `
    <url>
      <loc>${fullUrl}</loc>
      <lastmod>${today}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`;
}

/**
 * Main function to generate the sitemap
 */
async function generateSitemap() {
  console.log("Generating sitemap...");

  if (!BASE_URL.startsWith("http")) {
    console.error(
      'Error: BASE_URL in src/lib/generate-sitemap.ts must be a full URL (e.g., "https://example.com")'
    );
    process.exit(1);
  }

  // 1. Read the App.tsx file content
  const content = fs.readFileSync(ROUTER_FILE_PATH, "utf-8");

  // 2. Parse the file content into an AST
  const ast = parser.parse(content, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  // 3. Traverse the AST to find routes
  const pathStack: string[] = [];
  const foundRoutes: string[] = [];

  traverse(ast, {
    JSXOpeningElement: {
      enter(astPath) {
        const nodeName = astPath.node.name as JSXIdentifier;
        if (nodeName.name !== "Route") return;

        const pathProp = getAttributeValue(astPath, "path");
        const hasElement = astPath.node.attributes.some(
          (attr) => attr.type === "JSXAttribute" && attr.name.name === "element"
        );

        if (pathProp) {
          pathStack.push(pathProp);
        }

        if (hasElement && pathProp) {
          const fullRoute = joinPaths(pathStack);
          foundRoutes.push(fullRoute);
        }
      },

      exit(astPath) {
        const nodeName = astPath.node.name as JSXIdentifier;
        if (nodeName.name !== "Route") return;

        const pathProp = getAttributeValue(astPath, "path");
        if (pathProp) {
          pathStack.pop();
        }
      },
    },
  });

  // 4. Filter out dynamic paths or catch-alls
  const staticRoutes = foundRoutes.filter(
    (route) => !route.includes(":") && !route.includes("*")
  );

  // 5. Filter out ignored paths
  const filteredRoutes = staticRoutes.filter(
    (route) => !shouldIgnoreRoute(route)
  );

  console.log(`Found ${foundRoutes.length} total routes.`);
  console.log(`Filtered ${staticRoutes.length - filteredRoutes.length} ignored routes.`);
  console.log(`Final ${filteredRoutes.length} routes in sitemap.`);
  if (filteredRoutes.length > 0) {
    console.log("Routes:", filteredRoutes.join(", "));
  }

  // 6. Generate the XML
  const sitemapXml = createSitemapXml(filteredRoutes);

  // 7. Write the sitemap.xml file
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(SITEMAP_PATH, sitemapXml);

  console.log(`✅ Sitemap successfully generated at ${SITEMAP_PATH}`);
}

// Run the script
generateSitemap().catch(console.error);

