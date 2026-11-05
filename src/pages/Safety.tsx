import { Link } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { SectionTitle } from '../components/SectionTitle'

export default function Safety() {
  return <>
    <AppBar title="数据与安全" subtitle="痛风随访的使用边界" backTo="/profile" />
    <div className="space-y-5 px-4 pb-5 pt-4 text-[13px] leading-relaxed text-ink-soft">
      <section className="card p-4">
        <SectionTitle title="适用范围" />
        <p>供本人已由医生确诊痛风后，记录本次症状缓解、复诊复查安排、检查进度和报告原始信息。</p>
      </section>
      <section className="card p-4">
        <SectionTitle title="医疗边界" />
        <p>小满不作诊断，不判断血尿酸是否达标，不决定复查频率，也不提供药物名称、剂量或停换药建议。症状、报告结果和治疗安排请与医生核对。</p>
        <p className="mt-2">涉及急症征兆或用药提问时，小满优先提示就医或咨询医生、药师。</p>
      </section>
      <section className="card p-4">
        <SectionTitle title="数据来源与存储" />
        <p>随访信息由你在本机确认和录入。报告数值、单位和来源按原样保存；未填写的信息保持未知。当前没有连接医院、检验系统或真实设备。</p>
        <p className="mt-2">数据存于当前浏览器；你可以在“我的”管理本机记录。</p>
        <Link to="/profile" className="mt-3 inline-flex font-medium text-brand-deep">返回我的，管理本机数据 →</Link>
      </section>
    </div>
  </>
}
