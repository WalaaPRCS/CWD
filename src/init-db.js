import fs from'fs';import{pool,q}from'./db.js';await pool.query(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));await q("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS engagement_type TEXT NOT NULL DEFAULT 'volunteer'");await q("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS program_role TEXT");await q("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS job_title TEXT");await q("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS project_name TEXT");await q("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS contract_start DATE");await q("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS contract_end DATE");await q("INSERT INTO roles(name,permissions) VALUES('System Administrator','[\"*\"]') ON CONFLICT(name) DO UPDATE SET permissions=EXCLUDED.permissions");const a=[['chronic','متابعة الأمراض المزمنة','Chronic disease follow-up'],['community-support','الدعم المجتمعي','Community support'],['distribution','توزيع المواد والحقائب','Distribution of materials or kits'],['end-support','إنهاء تقديم الدعم','End of support'],['first-aid','تدخل الإسعاف الأولي','First aid intervention'],['group-education','التثقيف الصحي الجماعي','Group health education'],['consultation','الاستشارة الصحية الفردية','Individual health consultation'],['muac','فحص سوء التغذية','Malnutrition screening (MUAC)'],['other','خدمات الصحة المجتمعية الأخرى','Other community health service'],['psychosocial','الدعم النفسي والاجتماعي','Psychosocial support'],['referral','الإحالة','Referral'],['reproductive','متابعة الصحة الإنجابية','Reproductive health follow-up'],['injuries','دعم المصابين','Support for people with injuries']];for(let i=0;i<a.length;i++)await q('INSERT INTO services(code,name_ar,name_en,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO UPDATE SET name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,sort_order=EXCLUDED.sort_order',[...a[i],i+1]);const rules=[
['referral-followup','متابعة الإحالة','referral_followup',{source:'CHT tasks.js',trigger:'referral',first_days:3,repeat_days:7,max_events:8}],
['first-aid-monitoring','متابعة الإسعاف الأولي','first_aid_followup',{source:'CHT tasks.js',trigger:'first_aid.needs_monitoring=yes',due_days:3}],
['chronic-checkin','متابعة الأمراض المزمنة','chronic_followup',{source:'CHT tasks.js',trigger:'next_facility_visit_date'}],
['anc-checkin','متابعة الحوامل ANC','rh_followup',{source:'CHT tasks.js',trigger:'rh_status=pregnant + next_anc_date'}],
['pm-plus-next-session','جلسة PM+ التالية','psychosocial_support',{source:'CHT tasks.js',trigger:'pss_type=pm_plus and session<5',due_days:7}],
['friendly-followup','متابعة العيادة الصديقة','friendly_clinic_visit',{source:'CHT tasks.js',trigger:'followup_needed=yes + followup_date'}],
['vaccine-child-followup','متابعة الطفل غير المطعم','vaccine_child_followup',{source:'CHT tasks.js',trigger:'active vaccine_child',first_days:14,repeat_days:14,max_events:6}]
];for(const r of rules)await q('INSERT INTO task_rules(code,name,form_code,rule_json) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,form_code=EXCLUDED.form_code,rule_json=EXCLUDED.rule_json',[r[0],r[1],r[2],JSON.stringify(r[3])]);
const legacyFormCodes=['awareness_session','chronic_followup','community_support','consultation','disability_support','distribution','end_support','first_aid','first_aid_followup','friendly_clinic_visit','health_education','injury_support','muac_screening','other_health_service','psychosocial_support','referral','referral_followup','rh_followup','training','vaccination_screening','vaccine_child_followup'];for(const code of legacyFormCodes){const exists=(await q("SELECT id FROM forms WHERE source_system='cht' AND code=$1",[code])).rows[0];if(!exists){const f=(await q("INSERT INTO forms(name,description,status,code,form_type,source_system,source_metadata) VALUES($1,'Imported from previous CHT configuration','published',$1,'service','cht','{\"legacy\":true}'::jsonb) RETURNING id",[code])).rows[0];await q("INSERT INTO form_versions(form_id,version,schema_json) VALUES($1,1,$2::jsonb)",[f.id,JSON.stringify({source:'cht',legacyCode:code,pages:[]})]);}}console.log('Legacy CHT forms ensured:',legacyFormCodes.length);const operationalFormSchemas={
awareness_session:{title:'جلسة توعية صحية',service:'group-education',pages:[{title:'بيانات الجلسة',questions:[
{id:'session_date',label:'تاريخ الجلسة',type:'date',required:true},
{id:'location',label:'مكان تنفيذ الجلسة',type:'text',required:true},
{id:'topic',label:'موضوع التوعية',type:'text',required:true},
{id:'target_group',label:'الفئة المستهدفة',type:'single',required:true,options:['أطفال','يافعون','نساء','رجال','حوامل','أهالي ومقدمو رعاية','مجتمع عام']},
{id:'male_count',label:'عدد المشاركين الذكور',type:'number',required:true},
{id:'female_count',label:'عدد المشاركات الإناث',type:'number',required:true},
{id:'notes',label:'ملاحظات',type:'textarea',required:false}]}]},
referral:{title:'إحالة مستفيد',service:'referral',pages:[{title:'بيانات الإحالة',questions:[
{id:'referral_date',label:'تاريخ الإحالة',type:'date',required:true},
{id:'reason',label:'سبب الإحالة',type:'textarea',required:true},
{id:'destination',label:'جهة الإحالة',type:'text',required:true},
{id:'urgency',label:'درجة الأولوية',type:'single',required:true,options:['عادية','عاجلة','طارئة']},
{id:'transport_support',label:'هل يحتاج دعم للوصول إلى جهة الإحالة؟',type:'single',required:true,options:['نعم','لا']},
{id:'followup_needed',label:'هل تحتاج الإحالة إلى متابعة؟',type:'single',required:true,options:['نعم','لا']},
{id:'notes',label:'ملاحظات إضافية',type:'textarea',required:false}]}]},
referral_followup:{title:'متابعة الإحالة',service:'referral',pages:[{title:'نتيجة المتابعة',questions:[
{id:'followup_date',label:'تاريخ المتابعة',type:'date',required:true},
{id:'reached_facility',label:'هل وصل المستفيد إلى جهة الإحالة؟',type:'single',required:true,options:['نعم','لا']},
{id:'service_received',label:'هل تلقى الخدمة المطلوبة؟',type:'single',required:true,options:['نعم','لا','جزئيًا']},
{id:'barriers',label:'عوائق الوصول أو تلقي الخدمة',type:'textarea',required:false},
{id:'needs_another_followup',label:'هل يحتاج متابعة أخرى؟',type:'single',required:true,options:['نعم','لا']},
{id:'notes',label:'ملاحظات المتابعة',type:'textarea',required:false}]}]},
chronic_followup:{title:'متابعة الأمراض المزمنة',service:'chronic',pages:[{title:'الحالة والمتابعة',questions:[
{id:'condition',label:'الحالة أو المرض المزمن',type:'text',required:true},
{id:'medication_available',label:'هل الأدوية متوفرة للمستفيد؟',type:'single',required:true,options:['نعم','لا','جزئيًا']},
{id:'adherence',label:'الالتزام بالعلاج',type:'single',required:true,options:['منتظم','غير منتظم','لا يتناول العلاج']},
{id:'warning_signs',label:'هل توجد أعراض أو علامات تستدعي الإحالة؟',type:'single',required:true,options:['نعم','لا']},
{id:'counselling',label:'الإرشاد أو التثقيف المقدم',type:'textarea',required:false},
{id:'next_facility_visit_date',label:'موعد الزيارة القادمة للمنشأة الصحية',type:'date',required:false},
{id:'notes',label:'ملاحظات',type:'textarea',required:false}]}]},
vaccination_screening:{title:'فحص حالة التطعيم',service:null,pages:[{title:'فحص الطفل',questions:[
{id:'screening_date',label:'تاريخ الفحص',type:'date',required:true},
{id:'child_age_months',label:'عمر الطفل بالأشهر',type:'number',required:true},
{id:'vaccination_card_available',label:'هل بطاقة التطعيم متوفرة؟',type:'single',required:true,options:['نعم','لا']},
{id:'vaccination_status',label:'حالة التطعيم حسب العمر',type:'single',required:true,options:['مستكمل','غير مستكمل','غير معروف']},
{id:'missing_vaccines',label:'اللقاحات أو الجرعات غير المستكملة',type:'textarea',required:false},
{id:'referred_for_vaccination',label:'هل تم توجيه الطفل لخدمة التطعيم؟',type:'single',required:true,options:['نعم','لا']},
{id:'referral_facility',label:'العيادة / جهة التطعيم',type:'text',required:false},
{id:'notes',label:'ملاحظات',type:'textarea',required:false}]}]},
vaccine_child_followup:{title:'متابعة طفل غير مستكمل التطعيم',service:null,pages:[{title:'متابعة الطفل',questions:[
{id:'followup_date',label:'تاريخ المتابعة',type:'date',required:true},
{id:'parent_contacted',label:'هل تم التواصل مع ولي الأمر؟',type:'single',required:true,options:['نعم','لا']},
{id:'attended_vaccination',label:'هل حضر الطفل للحصول على التطعيم؟',type:'single',required:true,options:['نعم','لا']},
{id:'vaccination_completed',label:'هل استكمل الطفل الجرعات المطلوبة؟',type:'single',required:true,options:['نعم','لا','جزئيًا']},
{id:'barrier',label:'سبب عدم استكمال التطعيم إن وجد',type:'textarea',required:false},
{id:'next_followup_needed',label:'هل يحتاج متابعة أخرى؟',type:'single',required:true,options:['نعم','لا']},
{id:'notes',label:'ملاحظات',type:'textarea',required:false}]}]}
};
for(const [code,def] of Object.entries(operationalFormSchemas)){const row=(await q("SELECT f.id,f.name,f.description,f.current_version,v.schema_json FROM forms f JOIN form_versions v ON v.form_id=f.id AND v.version=f.current_version WHERE f.source_system='cht' AND f.code=$1",[code])).rows[0];if(!row)continue;const pages=row.schema_json?.pages||[];const hasRealQuestions=pages.some(p=>(p.questions||[]).some(x=>x.label&&x.label!=='سؤال جديد'));if(hasRealQuestions)continue;let serviceId=null;if(def.service)serviceId=(await q('SELECT id FROM services WHERE code=$1',[def.service])).rows[0]?.id||null;const schema={source:'cht',legacyCode:code,pages:def.pages.map((p,pi)=>({id:code+'_p'+(pi+1),title:p.title,nextRules:[],questions:p.questions}))};await q('UPDATE forms SET name=$2,description=$3,service_id=COALESCE($4,service_id),updated_at=now() WHERE id=$1',[row.id,def.title,'نموذج تشغيلي مبني على متطلبات برنامج الصحة المجتمعية',serviceId]);await q('UPDATE form_versions SET schema_json=$2::jsonb WHERE form_id=$1 AND version=$3',[row.id,JSON.stringify(schema),row.current_version]);}
console.log('Operational form schemas ensured:',Object.keys(operationalFormSchemas).length);const trainingCatalog=[['first_aid','First Aid'],['bls','Basic Life Support'],['cbhfa','Community-Based Health and First Aid (CBHFA)'],['community_first_responder','Community First Responder Skills'],['chronic_diseases','Chronic Diseases'],['infectious_diseases','Infectious Diseases'],['phie','Public Health in Emergencies (PHiE)'],['c4d','Communication for Development'],['sbcc','Social and Behavior Change Communication'],['pfa','Psychological First Aid (PFA)'],['pm_plus','Problem Management Plus (PM+)'],['sh_plus','Self-Help Plus (SH+)'],['gbv','Gender-Based Violence (GBV)'],['reproductive_health','Reproductive Health'],['vaccination','Vaccination'],['malnutrition','Malnutrition'],['breastfeeding','Breastfeeding'],['cbs','Community-Based Surveillance']];for(let i=0;i<trainingCatalog.length;i++)await q('INSERT INTO training_catalog(code,name,sort_order) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order',[trainingCatalog[i][0],trainingCatalog[i][1],i+1]);
// Rich, idempotent demo dataset for page-by-page UI review.
const demoVolunteers=[
[9001,'أحمد خليل','غزة','الرمال','0599001101','ميساء النجار','CBHS-D001'],
[9002,'سارة أبو عيشة','غزة','الشجاعية','0599001102','ميساء النجار','CBHS-D002'],
[9003,'محمد الحداد','شمال غزة','جباليا','0599001103','علاء المصري','CBHS-D003'],
[9004,'نور العطار','دير البلح','النصيرات','0599001104','هبة منصور','CBHS-D004'],
[9005,'خالد النجار','خانيونس','المواصي','0599001105','رامي القدرة','CBHS-D005'],
[9006,'دعاء شقورة','رفح','المواصي الغربية','0599001106','رامي القدرة','CBHS-D006']
];
for(const v of demoVolunteers){
 const x=(await q("INSERT INTO volunteers(volunteer_no,name,governorate,area,mobile,has_smartphone,facilitator_name,cbhs_id,metadata) VALUES($1,$2,$3,$4,$5,true,$6,$7,'{\"demo\":true}'::jsonb) ON CONFLICT(volunteer_no) DO UPDATE SET name=EXCLUDED.name,governorate=EXCLUDED.governorate,area=EXCLUDED.area,mobile=EXCLUDED.mobile,facilitator_name=EXCLUDED.facilitator_name,cbhs_id=EXCLUDED.cbhs_id RETURNING id",v)).rows[0];
 for(const activity of ['cbhs','health_awareness',...(v[0]%2?['immunization']:['reproductive_health'])])await q('INSERT INTO volunteer_activities(volunteer_id,activity_code) VALUES($1,$2) ON CONFLICT DO NOTHING',[x.id,activity]);
 for(const [eq,status] of [['vest','available'],['first_aid_kit',v[0]%3?'available':'needs_restock'],['glucometer',v[0]%2?'available':'not_available'],['blood_pressure_cuff','available']])await q('INSERT INTO volunteer_equipment(volunteer_id,equipment_code,status) VALUES($1,$2,$3) ON CONFLICT(volunteer_id,equipment_code) DO UPDATE SET status=EXCLUDED.status',[x.id,eq,status]);
 for(const tr of ['first_aid','cbhfa','chronic_diseases','pfa',...(v[0]%2?['vaccination','malnutrition']:['reproductive_health','sbcc'])])await q("INSERT INTO volunteer_trainings(volunteer_id,training_code,status,trained_at) VALUES($1,$2,'trained',CURRENT_DATE-30) ON CONFLICT(volunteer_id,training_code) DO UPDATE SET status='trained'",[x.id,tr]);
}
const demoBeneficiaries=[
['DEMO-001','أمل محمود حسن','0599102001','أنثى','1994-04-18','النساء'],
['DEMO-002','يوسف أحمد سالم','0599102002','ذكر','1965-09-03','ذوو الأمراض المزمنة'],
['DEMO-003','ليان خالد علي','0599102003','أنثى','2022-02-11','الأطفال'],
['DEMO-004','محمود رائد عمر','0599102004','ذكر','1987-07-25','البالغون'],
['DEMO-005','هدى سامي يوسف','0599102005','أنثى','1999-11-14','الحوامل'],
['DEMO-006','آدم فادي ناصر','0599102006','ذكر','2021-06-06','الأطفال'],
['DEMO-007','سناء إبراهيم خليل','0599102007','أنثى','1958-01-20','كبار السن'],
['DEMO-008','رامي ناصر محمد','0599102008','ذكر','2008-08-09','الناشئون']
];
const demoB=[];
for(const b of demoBeneficiaries)demoB.push((await q("INSERT INTO beneficiaries(external_id,name,phone,gender,birth_date,population_group,support_start_date,metadata) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE-45,'{\"demo\":true}'::jsonb) ON CONFLICT(external_id) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone,gender=EXCLUDED.gender,birth_date=EXCLUDED.birth_date,population_group=EXCLUDED.population_group RETURNING id",b)).rows[0].id);
const demoUser=(await q('SELECT id FROM users ORDER BY created_at LIMIT 1')).rows[0];
if(demoUser){
 const demoForms=(await q("SELECT id,code,current_version FROM forms WHERE code IN ('chronic_followup','first_aid','muac_screening','vaccination_screening','rh_followup','health_education','referral')")).rows;
 if(!(await q("SELECT 1 FROM submissions WHERE answers->>'demo_key'='cwd-demo-1' LIMIT 1")).rowCount){
  for(let i=0;i<demoForms.length;i++){const f=demoForms[i];await q("INSERT INTO submissions(form_id,form_version,beneficiary_id,submitted_by,answers,status,created_at) VALUES($1,$2,$3,$4,$5::jsonb,'submitted',now()-($6||' days')::interval)",[f.id,f.current_version,demoB[i%demoB.length],demoUser.id,JSON.stringify({demo_key:'cwd-demo-1',service:f.code,result:'completed'}),i+1]);}
  await q("INSERT INTO referrals(beneficiary_id,destination,status,referred_at,notes) VALUES($1,'عيادة الأمراض المزمنة - الهلال الأحمر','open',CURRENT_DATE-2,'متابعة ضغط الدم'),($2,'عيادة التطعيم','completed',CURRENT_DATE-8,'تمت مراجعة الطفل')",[demoB[1],demoB[2]]);
  await q("INSERT INTO tasks(beneficiary_id,title,due_date,status,metadata) VALUES($1,'متابعة الإحالة',CURRENT_DATE+1,'open','{\"demo\":true}'::jsonb),($2,'متابعة موعد ANC',CURRENT_DATE+3,'open','{\"demo\":true}'::jsonb),($3,'إعادة فحص MUAC',CURRENT_DATE+7,'open','{\"demo\":true}'::jsonb)",[demoB[1],demoB[4],demoB[5]]);
 }
}
await q("INSERT INTO system_settings(key,value) VALUES('demo_dataset','{\"enabled\":true,\"version\":1}'::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value");
console.log('CWD demo dataset ensured');
console.log('Database initialized with CHT-compatible task rules; first-run setup is handled by /setup');await pool.end();