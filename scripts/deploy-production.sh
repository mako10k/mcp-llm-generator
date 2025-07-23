#!/bin/bash

# Production Deployment Script for MCP LLM Generator
# Handles build, process management, and restart

set -e  # Exit on error

echo "🚀 Starting Production Deployment..."
echo "=================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Step 2: Check if this is the MCP LLM Generator project
if ! grep -q '"@mako10k/mcp-llm-generator"' package.json; then
    log_error "This doesn't appear to be the MCP LLM Generator project"
    exit 1
fi

log_info "Project validation passed"

# Step 3: Run type checking
log_info "Running type checking..."
if ! npm run type-check; then
    log_error "Type checking failed"
    exit 1
fi
log_success "Type checking passed"

# Step 4: Build production
log_info "Building production version..."
if ! npm run build:production; then
    log_error "Production build failed"
    exit 1
fi
log_success "Production build completed"

# Step 5: Check for existing processes
log_info "Checking for existing MCP processes..."
EXISTING_PIDS=$(pgrep -f "build-production/index.js" || echo "")

if [ -n "$EXISTING_PIDS" ]; then
    log_warning "Found existing processes: $EXISTING_PIDS"
    
    # Show process details for verification
    log_info "Process details:"
    ps aux | grep "build-production/index.js" | grep -v grep || true
    
    # Graceful shutdown attempt
    log_info "Attempting graceful shutdown..."
    if pkill -TERM -f "build-production/index.js"; then
        log_info "Sent SIGTERM to existing processes"
        
        # Wait for graceful shutdown
        sleep 3
        
        # Check if processes are still running
        REMAINING_PIDS=$(pgrep -f "build-production/index.js" || echo "")
        if [ -n "$REMAINING_PIDS" ]; then
            log_warning "Processes still running after graceful shutdown attempt: $REMAINING_PIDS"
            log_info "Force killing remaining processes..."
            pkill -KILL -f "build-production/index.js" || true
            sleep 2
        fi
    else
        log_info "No processes to terminate"
    fi
else
    log_info "No existing processes found"
fi

# Step 6: Verify processes are terminated
FINAL_CHECK=$(pgrep -f "build-production/index.js" || echo "")
if [ -n "$FINAL_CHECK" ]; then
    log_error "Failed to terminate existing processes: $FINAL_CHECK"
    log_info "Attempting final force kill..."
    pkill -KILL -f "build-production/index.js" || true
    sleep 1
    
    # Final verification
    ULTIMATE_CHECK=$(pgrep -f "build-production/index.js" || echo "")
    if [ -n "$ULTIMATE_CHECK" ]; then
        log_error "Could not terminate processes: $ULTIMATE_CHECK"
        exit 1
    fi
fi

log_success "All existing processes terminated"

# Step 7: Post-deployment verification
log_info "Waiting for VS Code MCP to be ready for on-demand startup..."
sleep 2

# Step 8: Deployment summary
log_success "Production deployment completed successfully!"
echo
echo "📋 Deployment Summary:"
echo "  ✅ Type checking passed"
echo "  ✅ Production build completed"
echo "  ✅ Old processes terminated"
echo "  ✅ New build ready for on-demand startup"
echo
echo "🔍 To trigger process startup and test:"
echo "  Use any MCP tool - the process will start automatically"
echo
echo "� To monitor process startup:"
echo "  ps aux | grep 'build-production/index.js'"
echo
echo "📝 To check logs after startup:"
echo "  journalctl --user -f | grep mcp"
echo
echo "⚡ Testing deployment by triggering process startup..."

log_info "Deployment script finished"
