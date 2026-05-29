const app = {
    // 意图协议 Schema（来自 intent-schema-compiler）
    schema: {
        type: "object",
        required: ["alert_level", "root_cause", "confidence_score"],
        properties: {
            alert_level: {
                type: "string",
                enum: ["P0", "P1", "P2", "P3"]
            },
            root_cause: {
                type: "string",
                minLength: 10,
                maxLength: 200
            },
            confidence_score: {
                type: "number",
                minimum: 0,
                maximum: 1
            },
            remediation: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        action_type: {
                            enum: ["manual", "escalation"]
                        }
                    }
                }
            }
        }
    },

    // 模拟 LLM 输出库
    mockOutputs: {
        valid: {
            label: "✅ 合法输出",
            data: {
                alert_level: "P0",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 0.85,
                remediation: [{ action_type: "manual", description: "检查内存占用进程" }]
            },
            expected: "PASS"
        },
        synonym: {
            label: "❌ 同义词漂移",
            data: {
                alert_level: "严重",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 0.85
            },
            expected: "BLOCK",
            errors: [{
                tier: "semantic",
                rule: "SEM-001",
                message: 'Value "严重" is not defined in enum ["P0","P1","P2","P3"]',
                ref: "#/properties/alert_level/Enum"
            }]
        },
        length: {
            label: "❌ 文案过短",
            data: {
                alert_level: "P0",
                root_cause: "CPU",
                confidence_score: 0.85
            },
            expected: "BLOCK",
            errors: [{
                tier: "syntax",
                rule: "SYN-002",
                message: "String 'CPU' is less than minimum length of 10",
                ref: "#/properties/root_cause/MinimumLength"
            }]
        },
        confidence: {
            label: "❌ 置信度越界",
            data: {
                alert_level: "P0",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 1.5
            },
            expected: "BLOCK",
            errors: [{
                tier: "syntax",
                rule: "SYN-003",
                message: "Float 1.5 exceeds maximum value of 1",
                ref: "#/properties/confidence_score/Maximum"
            }]
        },
        safety: {
            label: "❌ 安全违规",
            data: {
                alert_level: "P0",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 0.85,
                remediation: [{ action_type: "automated", description: "自动修复" }]
            },
            expected: "BLOCK",
            errors: [{
                tier: "safety",
                rule: "SAF-001",
                message: "AI 禁止建议自动执行。命中禁止模式: 'automated'",
                ref: "rules/safety/destructive.yaml"
            }]
        },
        multi: {
            label: "❌ 复合违规",
            data: {
                alert_level: "严重",
                root_cause: "CPU",
                confidence_score: 1.5
            },
            expected: "BLOCK",
            errors: [
                { tier: "semantic", rule: "SEM-001", message: 'Value "严重" is not defined in enum', ref: "#/properties/alert_level/Enum" },
                { tier: "syntax", rule: "SYN-002", message: "String 'CPU' is less than minimum length of 10", ref: "#/properties/root_cause/MinimumLength" },
                { tier: "syntax", rule: "SYN-003", message: "Float 1.5 exceeds maximum value of 1", ref: "#/properties/confidence_score/Maximum" }
            ]
        }
    },

    init() {
        this.selector = document.getElementById('llm-selector');
        this.schemaDisplay = document.getElementById('schema-display');
        this.jsonDisplay = document.getElementById('json-display');
        this.tierResults = document.getElementById('tier-results');
        this.finalVerdict = document.getElementById('final-verdict');
        this.alertCard = document.getElementById('alert-card');
        this.blockOverlay = document.getElementById('block-overlay');
        this.blockReason = document.getElementById('block-reason');

        // 显示 Schema
        this.schemaDisplay.textContent = JSON.stringify(this.schema, null, 2);

        // 绑定事件
        this.selector.addEventListener('change', (e) => this.run(e.target.value));
        
        // 默认运行合法示例
        this.run('valid');
    },

    run(key) {
        const scenario = this.mockOutputs[key];
        const data = scenario.data;

        // 显示原始 JSON
        this.jsonDisplay.textContent = JSON.stringify(data, null, 2);

        // 执行四层推演
        const result = this.validate(data, scenario.errors || []);

        // 渲染推演结果
        this.renderTiers(result);
        this.renderVerdict(result.passed);

        // 渲染卡片（如果通过）或拦截（如果阻断）
        if (result.passed) {
            this.renderCard(data);
            this.hideBlock();
        } else {
            this.renderCard(data, true); // 渲染但标记为违规
            this.showBlock(result.errors[0]);
        }
    },

    validate(data, expectedErrors) {
        const errors = [];
        let passed = true;

        // T1: 语法推演
        const t1Errors = [];
        if (data.root_cause && data.root_cause.length < 10) {
            t1Errors.push(`root_cause length ${data.root_cause.length} < 10`);
        }
        if (data.confidence_score !== undefined && (data.confidence_score < 0 || data.confidence_score > 1)) {
            t1Errors.push(`confidence_score ${data.confidence_score} out of range [0,1]`);
        }
        if (t1Errors.length > 0) {
            errors.push({ tier: "syntax", name: "语法推演", status: "block", detail: t1Errors.join("; ") });
            passed = false;
        } else {
            errors.push({ tier: "syntax", name: "语法推演", status: "pass", detail: "结构完整，字段类型正确" });
        }

        // T2: 语义推演（短路：如果 T1 失败则跳过）
        if (passed) {
            const t2Errors = [];
            if (!["P0", "P1", "P2", "P3"].includes(data.alert_level)) {
                t2Errors.push(`alert_level "${data.alert_level}" 不在语义令牌白名单中`);
            }
            if (t2Errors.length > 0) {
                errors.push({ tier: "semantic", name: "语义推演", status: "block", detail: t2Errors.join("; ") });
                passed = false;
            } else {
                errors.push({ tier: "semantic", name: "语义推演", status: "pass", detail: "语义令牌引用正确" });
            }
        } else {
            errors.push({ tier: "semantic", name: "语义推演", status: "skip", detail: "语法层阻断，短路终止" });
        }

        // T3: 安全推演（短路）
        if (passed) {
            const t3Errors = [];
            if (data.remediation && data.remediation.some(r => r.action_type === "automated")) {
                t3Errors.push("命中安全禁止模式: action_type='automated'");
            }
            if (t3Errors.length > 0) {
                errors.push({ tier: "safety", name: "安全推演", status: "block", detail: t3Errors.join("; ") });
                passed = false;
            } else {
                errors.push({ tier: "safety", name: "安全推演", status: "pass", detail: "无禁止模式命中" });
            }
        } else {
            errors.push({ tier: "safety", name: "安全推演", status: "skip", detail: "前层阻断，短路终止" });
        }

        // T4: 美感推演（不阻断）
        const t4Errors = [];
        if (data.root_cause && data.root_cause.length > 150) {
            t4Errors.push("文案长度超过 150 字符，建议精简");
        }
        errors.push({
            tier: "aesthetic",
            name: "美感推演",
            status: t4Errors.length > 0 ? "warn" : "pass",
            detail: t4Errors.length > 0 ? t4Errors.join("; ") : "信息密度与可读性达标"
        });

        return { passed, errors };
    },

    renderTiers(result) {
        const tierNames = {
            syntax: { icon: "📐", color: "pass" },
            semantic: { icon: "🔤", color: "pass" },
            safety: { icon: "🛡️", color: "pass" },
            aesthetic: { icon: "✨", color: "pass" }
        };

        this.tierResults.innerHTML = result.errors.map(err => {
            const statusClass = err.status === "pass" ? "pass" : err.status === "block" ? "block" : "skip";
            const icon = tierNames[err.tier].icon;
            return `
                <div class="tier-item ${statusClass}">
                    <div class="tier-icon">${err.status === "pass" ? "✅" : err.status === "block" ? "❌" : "⏸️"}</div>
                    <div class="tier-info">
                        <h4>${icon} ${err.name} [${err.status.toUpperCase()}]</h4>
                        <p>${err.detail}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderVerdict(passed) {
        this.finalVerdict.className = `verdict ${passed ? 'pass' : 'block'}`;
        this.finalVerdict.innerHTML = passed
            ? '✅ PASS — 四层推演通过，允许渲染'
            : '❌ BLOCK — 推演失败，强制拦截并升级人工';
    },

    renderCard(data, isViolated = false) {
        const level = data.alert_level;
        const isValidLevel = ["P0", "P1", "P2", "P3"].includes(level);
        const displayLevel = isValidLevel ? level : level;
        const cardClass = isValidLevel && level === "P0" ? "critical" : isValidLevel ? "warning" : "normal";
        
        const badgeClass = isValidLevel ? level.toLowerCase() : "severe";
        const badgeText = isValidLevel ? level : "UNKNOWN";

        let remediationHtml = '';
        if (data.remediation && data.remediation.length > 0) {
            const actions = data.remediation.map(r => 
                `<span style="color: ${r.action_type === 'automated' ? 'var(--color-block)' : 'var(--color-pass)'}">
                    ${r.action_type === 'automated' ? '⚠️ ' : '✓ '}${r.description}
                </span>`
            ).join('<br>');
            remediationHtml = `<div style="margin-top: 12px; font-size: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px;">${actions}</div>`;
        }

        const confidencePercent = Math.min(Math.max((data.confidence_score || 0) * 100, 0), 100);
        const confidenceClass = confidencePercent > 80 ? "high" : confidencePercent > 50 ? "medium" : "low";

        this.alertCard.className = `alert-card ${cardClass}`;
        this.alertCard.innerHTML = `
            <div class="alert-header">
                <span class="alert-badge ${badgeClass}">${badgeText}</span>
                ${isValidLevel && level === "P0" ? '<span class="pulse"></span>' : ''}
            </div>
            <div class="alert-title">系统告警</div>
            <div class="alert-cause">${data.root_cause || '未提供根因'}</div>
            <div class="alert-meta">
                <span>置信度: ${data.confidence_score !== undefined ? data.confidence_score : 'N/A'}</span>
                <span>${isViolated ? '⚠️ 存在违规' : '✓ 合规'}</span>
            </div>
            <div class="confidence-bar">
                <div class="confidence-fill ${confidenceClass}" style="width: ${confidencePercent}%"></div>
            </div>
            ${remediationHtml}
        `;
    },

    showBlock(firstError) {
        this.blockOverlay.classList.remove('hidden');
        this.blockReason.innerHTML = `
            <strong>违规层级：</strong>Four-Tier ${firstError.tier.toUpperCase()}<<br>
            <strong>规则编号：</strong>${firstError.rule || 'N/A'}<<br>
            <strong>拦截原因：</strong>${firstError.detail || firstError.message || '命中意图协议不可变边界'}<<br><br>
            <small>阻断优于修正：不触发 LLM 自动重试，直接升级人工</small>
        `;
    },

    hideBlock() {
        this.blockOverlay.classList.add('hidden');
    },

    reset() {
        this.selector.value = 'valid';
        this.run('valid');
    }
};

// 启动
document.addEventListener('DOMContentLoaded', () => app.init());
