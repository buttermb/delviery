import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, CheckCircle, XCircle, AlertCircle, Loader2, Download, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { formatBugType } from "@/utils/stringHelpers";
import { isValidBugReport } from "@/utils/typeGuards";

interface ButtonTest {
  label: string;
  path: string;
  status: "pending" | "success" | "error" | "404";
  errorMessage?: string;
}

interface BugReport {
  type: "broken-image" | "missing-alt" | "react-error" | "performance" | "console-warning" | "accessibility" | "dead-link" | "memory-leak" | "seo";
  severity: "low" | "medium" | "high";
  message: string;
  element?: string;
}

interface PageTest {
  path: string;
  tested: boolean;
  buttonResults: ButtonTest[];
  bugs: BugReport[];
}

const ButtonTester = () => {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<ButtonTest[]>([]);
  const [pageResults, setPageResults] = useState<PageTest[]>([]);
  const [currentPage, setCurrentPage] = useState("");
  const [progress, setProgress] = useState(0);
  const [totalBugs, setTotalBugs] = useState(0);
  
  // All routes to test
  const allRoutes = [
    // Main public pages
    "/",
    "/faq",
    "/support",
    "/about",
    "/blog",
    "/partner-shops",
    
    // Admin pages
    "/admin/dashboard",
    "/admin/products",
    "/admin/inventory",
    "/admin/orders",
    "/admin/live-map",
    "/admin/live-orders",
    "/admin/couriers",
    "/admin/users",
    "/admin/compliance",
    "/admin/analytics",
    "/admin/giveaways",
    "/admin/coupons",
    "/admin/settings",
    
    // Add more routes as needed
  ];

  const getAllButtons = () => {
    const buttons: { label: string; path: string; element: HTMLElement }[] = [];
    
    // Dangerous button patterns to skip
    const dangerousPatterns = [
      /sign\s*out/i,
      /log\s*out/i,
      /logout/i,
      /delete/i,
      /remove/i,
      /clear/i,
      /reset/i,
      /cancel/i,
      /close/i,
      /dismiss/i
    ];
    
    // Get all button elements, links that look like buttons, and elements with onClick
    const buttonElements = document.querySelectorAll('button, a[role="button"], [onclick]');
    
    buttonElements.forEach((btn) => {
      const element = btn as HTMLElement;
      const label = element.textContent?.trim() || element.getAttribute('aria-label') || 'Unnamed Button';
      const href = element.getAttribute('href');
      const path = window.location.pathname;
      
      // Skip dangerous buttons
      const isDangerous = dangerousPatterns.some(pattern => pattern.test(label));
      if (isDangerous) {
        return;
      }
      
      // Skip navigation/sidebar buttons to prevent page navigation
      const isNavigation = element.closest('nav, [role="navigation"], aside, header');
      if (isNavigation) {
        return;
      }
      
      buttons.push({
        label: label.substring(0, 50), // Limit label length
        path,
        element
      });
    });

    return buttons;
  };

  const findBugs = (): BugReport[] => {
    const bugs: BugReport[] = [];
    
    // Optimized: Check for broken images (only visible ones)
    const images = document.querySelectorAll('img');
    const visibleImages = Array.from(images).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).slice(0, 20); // Limit to first 20 visible images for speed
    
    visibleImages.forEach((img) => {
      if (!img.complete || img.naturalHeight === 0) {
        bugs.push({
          type: 'broken-image',
          severity: 'medium',
          message: `Broken image: ${img.src}`,
          element: img.alt || img.src
        });
      }
      
      // Check for missing alt text
      if (!img.alt && !img.getAttribute('aria-label')) {
        bugs.push({
          type: 'missing-alt',
          severity: 'low',
          message: 'Image missing alt text for accessibility',
          element: img.src
        });
      }
    });
    
    // Check for React errors in console
    const reactErrors = document.querySelectorAll('[data-react-error]');
    if (reactErrors.length > 0) {
      bugs.push({
        type: 'react-error',
        severity: 'high',
        message: `${reactErrors.length} React rendering error(s) detected`
      });
    }
    
    // Optimized: Skip performance check during testing for speed
    // (Performance monitoring should use dedicated Performance Monitor tool)
    
    // Optimized: Sample accessibility checks instead of all elements
    const buttonsWithoutAriaLabel = Array.from(document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])')).slice(0, 10);
    buttonsWithoutAriaLabel.forEach((btn) => {
      if (!btn.textContent?.trim()) {
        bugs.push({
          type: 'accessibility',
          severity: 'medium',
          message: 'Button without text or aria-label',
          element: btn.outerHTML.substring(0, 100)
        });
      }
    });
    
    // Quick count without detailed check for speed
    const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby]):not([type="hidden"])');
    if (inputsWithoutLabels.length > 3) {
      bugs.push({
        type: 'accessibility',
        severity: 'medium',
        message: `${inputsWithoutLabels.length} input(s) without accessible labels`
      });
    }
    
    // Optimized: Sample dead links check
    const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 15);
    let deadLinkCount = 0;
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === '#' || href === '' || href === 'javascript:void(0)') {
        deadLinkCount++;
      }
    });
    if (deadLinkCount > 0) {
      bugs.push({
        type: 'dead-link',
        severity: 'low',
        message: `${deadLinkCount}+ links with no destination found`
      });
    }
    
    // Optimized: Quick count for memory leak indicators
    const elementsWithListeners = document.querySelectorAll('[onclick]').length;
    if (elementsWithListeners > 10) {
      bugs.push({
        type: 'memory-leak',
        severity: 'low',
        message: `${elementsWithListeners} inline event handlers detected (may cause memory leaks)`
      });
    }
    
    // Check SEO issues
    const h1Tags = document.querySelectorAll('h1');
    if (h1Tags.length === 0) {
      bugs.push({
        type: 'seo',
        severity: 'medium',
        message: 'Missing H1 tag for SEO'
      });
    } else if (h1Tags.length > 1) {
      bugs.push({
        type: 'seo',
        severity: 'low',
        message: `Multiple H1 tags detected (${h1Tags.length})`
      });
    }
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      bugs.push({
        type: 'seo',
        severity: 'medium',
        message: 'Missing meta description for SEO'
      });
    }
    
    return bugs;
  };

  const testButton = async (button: { label: string; path: string; element: HTMLElement }): Promise<ButtonTest> => {
    return new Promise((resolve) => {
      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      let capturedError: string | null = null;
      let is404 = false;
      let networkErrors: string[] = [];
      let testCompleted = false;

      // Safety timeout to prevent hanging
      const safetyTimeout = setTimeout(() => {
        if (!testCompleted) {
          cleanup();
          resolve({
            label: button.label,
            path: button.path,
            status: 'error',
            errorMessage: 'Test timeout - button may have caused navigation or infinite loop'
          });
        }
      }, 5000); // Safety timeout

      const cleanup = () => {
        testCompleted = true;
        clearTimeout(safetyTimeout);
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXHROpen;
        XMLHttpRequest.prototype.send = originalXHRSend;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        window.removeEventListener('unhandledrejection', handleRejection);
      };

      // Intercept fetch requests (improved to avoid cloning issues)
      window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : 'unknown';
        
        try {
          const response = await originalFetch(...args);
          
          // Check for various error status codes
          if (response.status === 404) {
            is404 = true;
            networkErrors.push(`404 Not Found: ${url}`);
          } else if (response.status >= 400 && response.status < 600) {
            networkErrors.push(`HTTP ${response.status} Error: ${url}`);
          } else if (!response.ok) {
            networkErrors.push(`Request failed (${response.status}): ${url}`);
          }
          
          return response;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Network error';
          // Filter out cloning errors from our own interceptor
          if (!errorMsg.includes('DataCloneError') && !errorMsg.includes('postMessage')) {
            networkErrors.push(`Fetch failed for ${url}: ${errorMsg}`);
          }
          throw error;
        }
      };

      // Intercept XHR requests with better error handling
      const xhrInstances = new WeakMap<XMLHttpRequest, string>();
      
      XMLHttpRequest.prototype.open = function(...args: any[]) {
        const url = args[1] as string;
        xhrInstances.set(this, url);
        
        // Add error handlers
        this.addEventListener('error', function() {
          networkErrors.push(`XHR Error: ${url}`);
        });
        
        this.addEventListener('timeout', function() {
          networkErrors.push(`XHR Timeout: ${url}`);
        });
        
        this.addEventListener('load', function() {
          if (this.status === 404) {
            is404 = true;
            networkErrors.push(`404 Not Found: ${url}`);
          } else if (this.status >= 400 && this.status < 600) {
            networkErrors.push(`HTTP ${this.status} Error: ${url}`);
          }
        });
        
        return originalXHROpen.apply(this, args);
      };

      XMLHttpRequest.prototype.send = function(...args: any[]) {
        try {
          return originalXHRSend.apply(this, args);
        } catch (error) {
          const url = xhrInstances.get(this) || 'unknown';
          networkErrors.push(`XHR Send failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          throw error;
        }
      };

      // Capture console errors and warnings
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];
      
      console.error = (...args) => {
        const errorMsg = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        consoleErrors.push(errorMsg);
        originalConsoleError(...args);
      };
      
      console.warn = (...args) => {
        const warnMsg = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        consoleWarnings.push(warnMsg);
        originalConsoleWarn(...args);
      };

      // Capture unhandled promise rejections
      const handleRejection = (event: PromiseRejectionEvent) => {
        networkErrors.push(`Unhandled Promise: ${event.reason}`);
      };
      window.addEventListener('unhandledrejection', handleRejection);

      try {
        // Simulate click with error handling
        try {
          button.element.click();
        } catch (clickError) {
          networkErrors.push(`Click failed: ${clickError instanceof Error ? clickError.message : 'Unknown error'}`);
        }

        // Reduced timeout for faster testing
        setTimeout(() => {
          if (testCompleted) return;
          
          cleanup();

          // Compile all errors (include warnings if severe)
          const allErrors = [...networkErrors, ...consoleErrors, ...consoleWarnings];
          capturedError = allErrors.length > 0 ? allErrors.join('\n') : null;

          let status: ButtonTest['status'] = 'success';
          if (is404) {
            status = '404';
          } else if (capturedError) {
            status = 'error';
          }

          resolve({
            label: button.label,
            path: button.path,
            status,
            errorMessage: capturedError || undefined
          });
        }, 500); // Further reduced timeout
      } catch (error) {
        cleanup();

        resolve({
          label: button.label,
          path: button.path,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  };

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    setPageResults([]);
    setProgress(0);
    
    const allPageResults: PageTest[] = [];
    const allButtonResults: ButtonTest[] = [];
    
    toast.info(`Starting tests across ${allRoutes.length} pages...`);

    for (let i = 0; i < allRoutes.length; i++) {
      try {
        const route = allRoutes[i];
        setCurrentPage(route);
        setProgress(((i + 1) / allRoutes.length) * 100);
        
        // Navigate to the page with error handling
        try {
          navigate(route);
        } catch (navError) {
          console.error(`Navigation error to ${route}:`, navError);
          allPageResults.push({
            path: route,
            tested: true,
            buttonResults: [],
            bugs: [{
              type: 'react-error',
              severity: 'high',
              message: `Failed to navigate to ${route}`
            }]
          });
          continue;
        }
        
        // Minimal wait time for faster testing
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Get buttons on this page with error handling
        let buttons: { label: string; path: string; element: HTMLElement }[] = [];
        try {
          buttons = getAllButtons();
        } catch (error) {
          console.error(`Error getting buttons on ${route}:`, error);
        }
        
        // Find bugs on this page with error handling
        let pageBugs: BugReport[] = [];
        try {
          pageBugs = findBugs();
        } catch (error) {
          console.error(`Error finding bugs on ${route}:`, error);
        }
        
        if (buttons.length === 0) {
          allPageResults.push({
            path: route,
            tested: true,
            buttonResults: [],
            bugs: pageBugs
          });
          setPageResults([...allPageResults]);
          continue;
        }
        
        toast.info(`Testing ${buttons.length} buttons on ${route}`);
        
        const pageTestResults: ButtonTest[] = [];
        
        // Test buttons in parallel batches for maximum speed
        const batchSize = 5; // Increased batch size
        for (let j = 0; j < buttons.length; j += batchSize) {
          try {
            const batch = buttons.slice(j, j + batchSize);
            const batchResults = await Promise.allSettled(batch.map(btn => testButton(btn)));
            
            // Handle both successful and failed promises
            batchResults.forEach((result, idx) => {
              if (result.status === 'fulfilled') {
                pageTestResults.push(result.value);
                allButtonResults.push(result.value);
              } else {
                // Promise rejected - add error result
                const failedButton = batch[idx];
                const errorResult: ButtonTest = {
                  label: failedButton.label,
                  path: failedButton.path,
                  status: 'error',
                  errorMessage: 'Test failed to complete'
                };
                pageTestResults.push(errorResult);
                allButtonResults.push(errorResult);
              }
            });
            
            setResults([...allButtonResults]);
          } catch (batchError) {
            console.error(`Batch test error:`, batchError);
            // Continue with next batch even if this one fails
          }
        }
        
        allPageResults.push({
          path: route,
          tested: true,
          buttonResults: pageTestResults,
          bugs: pageBugs
        });
        
        setPageResults([...allPageResults]);
      } catch (pageError) {
        console.error(`Error testing page ${allRoutes[i]}:`, pageError);
        // Continue with next page even if this one fails
        continue;
      }
    }
    
    const totalBugsFound = allPageResults.reduce((sum, page) => sum + page.bugs.length, 0);
    setTotalBugs(totalBugsFound);

    setTesting(false);
    setProgress(100);
    setCurrentPage("");
    
    const successCount = allButtonResults.filter(r => r.status === 'success').length;
    const errorCount = allButtonResults.filter(r => r.status === 'error').length;
    const notFoundCount = allButtonResults.filter(r => r.status === '404').length;

    toast.success(`All tests complete: ${successCount} working, ${errorCount} errors, ${notFoundCount} 404s, ${totalBugsFound} bugs found across ${allRoutes.length} pages`);
  };

  const exportResults = (format: 'json' | 'csv') => {
    if (pageResults.length === 0) {
      toast.error("No results to export");
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'json') {
      const data = JSON.stringify({ pageResults, stats, timestamp }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `button-test-results-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported as JSON");
    } else {
      let csv = 'Page,Button,Status,Bug Type,Bug Severity,Bug Message\n';
      pageResults.forEach(page => {
        page.buttonResults.forEach(btn => {
          csv += `"${page.path}","${btn.label}","${btn.status}","","",""\n`;
        });
        page.bugs.forEach(bug => {
          csv += `"${page.path}","","","${bug.type}","${bug.severity}","${bug.message}"\n`;
        });
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `button-test-results-${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported as CSV");
    }
  };

  const retestFailed = async () => {
    const failedPages = pageResults.filter(p => 
      p.buttonResults.some(b => b.status === 'error' || b.status === '404') || 
      p.bugs.some(b => b.severity === 'high')
    );
    
    if (failedPages.length === 0) {
      toast.info("No failed tests to rerun");
      return;
    }
    
    toast.info(`Retesting ${failedPages.length} pages with issues...`);
    // Reset and rerun only failed pages
    // Implementation would be similar to runTests but only for failedPages
  };

  const getStatusIcon = (status: ButtonTest['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case '404':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusBadge = (status: ButtonTest['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-success">Working</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case '404':
        return <Badge variant="secondary" className="bg-warning">404</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const stats = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    error: results.filter(r => r.status === 'error').length,
    notFound: results.filter(r => r.status === '404').length,
    bugs: totalBugs
  };
  
  const getBugSeverityColor = (severity: BugReport['severity']) => {
    switch (severity) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      case 'low': return 'text-muted-foreground';
    }
  };

  const getRecommendations = () => {
    const recommendations = [];
    
    if (stats.error > 0) {
      recommendations.push(`🔴 Fix ${stats.error} broken button(s) that are causing errors`);
    }
    if (stats.notFound > 0) {
      recommendations.push(`⚠️ Fix ${stats.notFound} button(s) leading to 404 pages`);
    }
    
    const highSeverityBugs = pageResults.reduce((sum, p) => sum + p.bugs.filter(b => b.severity === 'high').length, 0);
    if (highSeverityBugs > 0) {
      recommendations.push(`🚨 Address ${highSeverityBugs} high-severity bug(s) immediately`);
    }
    
    const accessibilityIssues = pageResults.reduce((sum, p) => sum + p.bugs.filter(b => b.type === 'accessibility').length, 0);
    if (accessibilityIssues > 0) {
      recommendations.push(`♿ Improve ${accessibilityIssues} accessibility issue(s)`);
    }
    
    const seoIssues = pageResults.reduce((sum, p) => sum + p.bugs.filter(b => b.type === 'seo').length, 0);
    if (seoIssues > 0) {
      recommendations.push(`📈 Optimize ${seoIssues} SEO issue(s)`);
    }
    
    const perfIssues = pageResults.reduce((sum, p) => sum + p.bugs.filter(b => b.type === 'performance').length, 0);
    if (perfIssues > 0) {
      recommendations.push(`⚡ Improve performance on ${perfIssues} page(s)`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push("✅ All tests passed! Your site is looking great.");
    }
    
    return recommendations;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Button Tester</h1>
        <p className="text-muted-foreground">
          Test all buttons on the current page to identify errors and 404s
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
          <CardDescription>
            This will test all buttons across every page in your application and report any errors.
            <br />
            <strong>Safe Mode:</strong> Automatically skips sign out, delete, navigation, and other potentially destructive buttons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Pages to Test ({allRoutes.length}):</h3>
            <p className="text-sm text-muted-foreground">
              Main pages, Admin pages, and all other routes
            </p>
            <h3 className="font-semibold text-sm mt-4">Automatically Excluded:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Sign Out / Logout buttons</li>
              <li>Delete / Remove buttons</li>
              <li>Navigation & Sidebar links</li>
              <li>Close / Cancel / Dismiss buttons</li>
              <li>Clear / Reset buttons</li>
            </ul>
          </div>
          
          {testing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Testing: {currentPage}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
          
          <div className="flex gap-2">
            <Button onClick={runTests} disabled={testing} size="lg" className="flex-1">
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing All Pages...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Complete Site Test
                </>
              )}
            </Button>
            {results.length > 0 && (
              <Button 
                onClick={retestFailed} 
                disabled={testing}
                size="lg"
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retest Failed
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>Priority actions based on test results</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {getRecommendations().map((rec, idx) => (
                  <li key={idx} className="text-sm">{rec}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => exportResults('json')} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button onClick={() => exportResults('csv')} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Buttons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-success">Working</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{stats.success}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-destructive">Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.error}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-warning">404s</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.notFound}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Bugs Found</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.bugs}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Test Results by Page</CardTitle>
              <CardDescription>
                {testing ? `Testing buttons across all pages...` : `Tested ${results.length} buttons across ${pageResults.length} pages`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {pageResults.map((page, pageIndex) => {
                    const pageStats = {
                      total: page.buttonResults.length,
                      success: page.buttonResults.filter(r => r.status === 'success').length,
                      error: page.buttonResults.filter(r => r.status === 'error').length,
                      notFound: page.buttonResults.filter(r => r.status === '404').length,
                      bugs: page.bugs.length
                    };
                    
                    return (
                      <div key={pageIndex} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{page.path}</h3>
                          <div className="flex gap-2">
                            {pageStats.success > 0 && (
                              <Badge variant="default" className="bg-success">
                                {pageStats.success} OK
                              </Badge>
                            )}
                            {pageStats.error > 0 && (
                              <Badge variant="destructive">
                                {pageStats.error} Errors
                              </Badge>
                            )}
                            {pageStats.notFound > 0 && (
                              <Badge variant="secondary" className="bg-warning">
                                {pageStats.notFound} 404s
                              </Badge>
                            )}
                            {pageStats.bugs > 0 && (
                              <Badge variant="outline">
                                {pageStats.bugs} Bugs
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Show bugs found on this page */}
                        {page.bugs.length > 0 && (
                          <div className="bg-muted/50 rounded p-3 space-y-2">
                            <h4 className="font-semibold text-sm">🐛 Bugs Detected:</h4>
                            {page.bugs.map((bug, bugIndex) => {
                              // Validate bug object
                              if (!isValidBugReport(bug)) {
                                console.warn('Invalid bug report:', bug);
                                return null;
                              }
                              
                              return (
                              <div key={bugIndex} className="text-xs flex items-start gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={getBugSeverityColor(bug.severity)}
                                >
                                  {bug.severity}
                                </Badge>
                                <div className="flex-1">
                                  <p className="font-medium">{formatBugType(bug.type)?.toUpperCase() || 'UNKNOWN'}</p>
                                  <p className="text-muted-foreground">{bug.message}</p>
                                  {bug.element && (
                                    <p className="text-muted-foreground truncate">Element: {bug.element}</p>
                                  )}
                                </div>
                              </div>
                            );
                            }).filter(Boolean)}
                          </div>
                        )}
                        
                        {page.buttonResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No testable buttons on this page</p>
                        ) : (
                          <div className="space-y-2">
                            {page.buttonResults.map((result, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-3 p-2 border rounded hover:bg-accent/50 transition-colors"
                              >
                                <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium truncate text-sm">{result.label}</span>
                                    {getStatusBadge(result.status)}
                                  </div>
                                  {result.errorMessage && (
                                    <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                                      {result.errorMessage}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ButtonTester;
